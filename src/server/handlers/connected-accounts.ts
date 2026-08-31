import type { ProviderConfig } from "@/generated/prisma/client";
import { google } from "googleapis";
import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/server/config/env";
import { prisma } from "@/server/config/prisma";
import { type AuthUser, requireAuthUser } from "@/server/http/auth";
import { errorJson, json } from "@/server/http/responses";
import {
  createOAuthClient,
  browseGoogleDriveFolder,
  ensureGlobalGoogleProviderConfig,
  getAuthedGoogleClient,
  syncGoogleQuota,
} from "@/server/modules/google/google.service";
import {
  isBrowserInlineImageMimeType,
  isHeicLike,
  streamGoogleDriveThumbnailResponse,
  streamGoogleProviderFileResponse,
} from "@/server/modules/files/stream-google-file";
import { encryptText, hashToken, randomToken } from "@/server/utils/crypto";
import { serializeStorageAccount } from "@/server/lib/storage-serialize";

export async function createGoogleConnectUrl(
  userId: string,
  request: Request,
): Promise<string | Response> {
  const url = new URL(request.url);
  const query = z
    .object({ providerConfigId: z.string().min(1).optional() })
    .parse(Object.fromEntries(url.searchParams));

  let config: ProviderConfig | null = null;
  if (query.providerConfigId) {
    config = await prisma.providerConfig.findFirst({
      where: {
        id: query.providerConfigId,
        OR: [{ userId }, { userId: null }],
        provider: "google_drive",
        status: "active",
      },
    });
    if (!config) {
      return errorJson(
        "GOOGLE_NOT_CONFIGURED",
        "Google OAuth configuration not found.",
        404,
      );
    }
  } else {
    config = await ensureGlobalGoogleProviderConfig();
    if (!config) {
      return errorJson(
        "GOOGLE_NOT_CONFIGURED",
        "Google Drive is not configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env, then run pnpm seed:google-config.",
        503,
      );
    }
  }

  const state = randomToken();
  await prisma.oauthState.create({
    data: {
      userId,
      providerConfigId: config.id,
      flow: "connect",
      stateHash: hashToken(state),
      expiresAt: new Date(Date.now() + 10 * 60_000),
    },
  });
  const client = createOAuthClient(config);
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: config.scopes as string[],
    state,
  });
}

export async function listConnectedAccountsHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const accounts = await prisma.connectedAccount.findMany({
    where: { userId: user.id, status: "connected" },
    include: { storageAccount: true },
    orderBy: { createdAt: "desc" },
  });
  const missingQuota = accounts.filter(
    (account) => !account.storageAccount?.lastSyncedAt,
  );
  for (const account of missingQuota)
    await syncGoogleQuota(account.id).catch(() => undefined);

  const syncedAccounts =
    missingQuota.length > 0
      ? await prisma.connectedAccount.findMany({
          where: { userId: user.id, status: "connected" },
          include: { storageAccount: true },
          orderBy: { createdAt: "desc" },
        })
      : accounts;

  return json({
    accounts: syncedAccounts.map(
      ({
        accessTokenEncrypted: _a,
        refreshTokenEncrypted: _r,
        storageAccount,
        ...account
      }) => ({
        ...account,
        storageAccount: storageAccount
          ? serializeStorageAccount(storageAccount)
          : null,
      }),
    ),
  });
}

export async function googleConnectUrlHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const url = await createGoogleConnectUrl(user.id, request);
  if (url instanceof Response) return url;
  return json({ url });
}

export async function googleConnectHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const url = await createGoogleConnectUrl(user.id, request);
  if (url instanceof Response) return url;
  return NextResponse.redirect(url);
}

export async function googleCallbackHandler(request: Request) {
  try {
    const url = new URL(request.url);
    const query = z
      .object({ code: z.string(), state: z.string() })
      .parse(Object.fromEntries(url.searchParams));
    const oauthState = await prisma.oauthState.findUniqueOrThrow({
      where: { stateHash: hashToken(query.state) },
      include: { providerConfig: true },
    });
    if (oauthState.usedAt || oauthState.expiresAt < new Date())
      return errorJson(
        "GOOGLE_OAUTH_STATE_INVALID",
        "OAuth state expired.",
        400,
      );
    const client = createOAuthClient(oauthState.providerConfig);
    const tokenResult = await client.getToken(query.code);
    const tokens = tokenResult.tokens;
    if (!tokens.access_token)
      return errorJson(
        "GOOGLE_OAUTH_FAILED",
        "Google did not return required tokens.",
        400,
      );
    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const profile = await oauth2.userinfo.get();
    const providerAccountId = profile.data.id;
    const email = profile.data.email;
    if (!providerAccountId || !email)
      return errorJson(
        "GOOGLE_PROFILE_FAILED",
        "Google profile missing id or email.",
        400,
      );

    if (oauthState.flow !== "connect" || !oauthState.userId)
      return errorJson(
        "GOOGLE_OAUTH_STATE_INVALID",
        "OAuth state expired.",
        400,
      );
    const existingAccount = await prisma.connectedAccount.findUnique({
      where: {
        userId_provider_providerAccountId: {
          userId: oauthState.userId,
          provider: "google_drive",
          providerAccountId,
        },
      },
    });
    const refreshTokenEncrypted = tokens.refresh_token
      ? encryptText(tokens.refresh_token)
      : existingAccount?.refreshTokenEncrypted;
    if (!refreshTokenEncrypted)
      return errorJson(
        "GOOGLE_OAUTH_FAILED",
        "Google did not return required tokens.",
        400,
      );

    const account = await prisma.connectedAccount.upsert({
      where: {
        userId_provider_providerAccountId: {
          userId: oauthState.userId,
          provider: "google_drive",
          providerAccountId,
        },
      },
      create: {
        userId: oauthState.userId,
        providerConfigId: oauthState.providerConfigId,
        provider: "google_drive",
        providerAccountId,
        email,
        displayName: profile.data.name,
        avatarUrl: profile.data.picture,
        accessTokenEncrypted: encryptText(tokens.access_token),
        refreshTokenEncrypted,
        tokenExpiresAt: new Date(tokens.expiry_date ?? Date.now() + 3600_000),
        scopes: oauthState.providerConfig.scopes as string[],
        status: "connected",
      },
      update: {
        providerConfigId: oauthState.providerConfigId,
        email,
        displayName: profile.data.name,
        avatarUrl: profile.data.picture,
        accessTokenEncrypted: encryptText(tokens.access_token),
        refreshTokenEncrypted,
        tokenExpiresAt: new Date(tokens.expiry_date ?? Date.now() + 3600_000),
        scopes: oauthState.providerConfig.scopes as string[],
        status: "connected",
      },
    });
    await prisma.oauthState.update({
      where: { id: oauthState.id },
      data: { usedAt: new Date() },
    });
    await syncGoogleQuota(account.id);
    return NextResponse.redirect(
      `${env.APP_URL}/google-connected?status=success`,
    );
  } catch (error) {
    console.error("Google OAuth callback failed:", error);
    return NextResponse.redirect(
      `${env.APP_URL}/google-connected?status=error`,
    );
  }
}

export async function syncQuotaHandler(
  request: Request,
  _user?: AuthUser,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const accountId = params?.id;
  if (!accountId)
    return errorJson("VALIDATION_ERROR", "Account id required.", 400);
  const account = await prisma.connectedAccount.findFirstOrThrow({
    where: { id: accountId, userId: user.id },
  });
  const quota = await syncGoogleQuota(account.id);
  return json({
    quota: serializeStorageAccount(quota),
  });
}

export async function disconnectAccountHandler(
  request: Request,
  _user?: AuthUser,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const accountId = params?.id;
  if (!accountId) return json({ status: "ok" });
  await prisma.connectedAccount.updateMany({
    where: { id: accountId, userId: user.id },
    data: { status: "disconnected" },
  });
  return json({ status: "ok" });
}

export async function browseConnectedAccountHandler(
  request: Request,
  _user?: AuthUser,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const accountId = params?.id;
  if (!accountId) {
    return errorJson("VALIDATION_ERROR", "Account id required.", 400);
  }

  const url = new URL(request.url);
  const query = z
    .object({
      parentId: z.string().optional(),
      q: z.string().trim().max(255).optional(),
    })
    .parse(Object.fromEntries(url.searchParams));

  const account = await prisma.connectedAccount.findFirst({
    where: { id: accountId, userId: user.id, status: "connected" },
  });
  if (!account) {
    return errorJson("ACCOUNT_NOT_FOUND", "Connected account not found.", 404);
  }

  const parentId = query.parentId?.trim() || "root";

  if (account.provider !== "google_drive") {
    return errorJson(
      "UNSUPPORTED_PROVIDER",
      "Browsing is not supported for this provider.",
      400,
    );
  }

  const result = await browseGoogleDriveFolder(
    accountId,
    user.id,
    parentId,
    query.q,
  );
  return json(result);
}

async function getOwnedConnectedAccount(accountId: string, userId: string) {
  const account = await prisma.connectedAccount.findFirst({
    where: { id: accountId, userId, status: "connected" },
  });
  if (!account) {
    return errorJson("ACCOUNT_NOT_FOUND", "Connected account not found.", 404);
  }
  return account;
}

export async function previewConnectedAccountFileHandler(
  request: Request,
  _user?: AuthUser,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const accountId = params?.id;
  const providerFileId = params?.fileId;
  if (!accountId || !providerFileId) {
    return errorJson("VALIDATION_ERROR", "Account and file id required.", 400);
  }

  const account = await getOwnedConnectedAccount(accountId, user.id);
  if (account instanceof Response) return account;

  if (account.provider === "google_drive") {
    const auth = await getAuthedGoogleClient(account);
    const drive = google.drive({ version: "v3", auth });
    const metadata = await drive.files.get({
      fileId: providerFileId,
      fields: "id,name,mimeType",
      supportsAllDrives: true,
    });
    if (!metadata.data.id || !metadata.data.name) {
      return errorJson("FILE_NOT_FOUND", "File not found on this drive.", 404);
    }

    const mimeType = metadata.data.mimeType ?? "application/octet-stream";
    const name = metadata.data.name;
    const range = request.headers.get("range") ?? undefined;

    if (
      isHeicLike(mimeType, name) ||
      (mimeType.startsWith("image/") &&
        !isBrowserInlineImageMimeType(mimeType, name))
    ) {
      return streamGoogleDriveThumbnailResponse(account, providerFileId);
    }

    return streamGoogleProviderFileResponse(
      account,
      { providerFileId, mimeType, name },
      range,
      { disposition: "inline" },
    );
  }

  return errorJson(
    "UNSUPPORTED_PROVIDER",
    "Preview is not supported for this provider.",
    400,
  );
}

export async function thumbnailConnectedAccountFileHandler(
  request: Request,
  _user?: AuthUser,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const accountId = params?.id;
  const providerFileId = params?.fileId;
  if (!accountId || !providerFileId) {
    return errorJson("VALIDATION_ERROR", "Account and file id required.", 400);
  }

  const account = await getOwnedConnectedAccount(accountId, user.id);
  if (account instanceof Response) return account;

  if (account.provider === "google_drive") {
    return streamGoogleDriveThumbnailResponse(account, providerFileId);
  }

  return errorJson(
    "UNSUPPORTED_PROVIDER",
    "Thumbnails are not supported for this provider.",
    400,
  );
}
