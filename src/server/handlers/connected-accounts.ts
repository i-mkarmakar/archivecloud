import { Readable } from "node:stream";
import { google } from "googleapis";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { ProviderConfig } from "@/generated/prisma/client";
import { env } from "@/server/config/env";
import { prisma } from "@/server/config/prisma";
import { type AuthUser, requireAuthUser } from "@/server/http/auth";
import { oauthConnectStartResponse } from "@/server/http/oauth-connect-response";
import { errorJson, json } from "@/server/http/responses";
import { serializeStorageAccount } from "@/server/lib/storage-serialize";
import {
  buildDropboxAuthUrl,
  ensureGlobalDropboxProviderConfig,
  exchangeDropboxCode,
  getDropboxAccountProfileWithToken,
  syncDropboxQuota,
} from "@/server/modules/dropbox/dropbox.service";
import {
  isBrowserInlineImageMimeType,
  isHeicLike,
  streamGoogleDriveThumbnailResponse,
  streamGoogleProviderFileResponse,
} from "@/server/modules/files/stream-google-file";
import {
  createOAuthClient,
  ensureGlobalGoogleProviderConfig,
  getAuthedGoogleClient,
  syncGoogleQuota,
} from "@/server/modules/google/google.service";
import {
  buildOneDriveAuthUrl,
  ensureGlobalOneDriveProviderConfig,
  exchangeOneDriveCode,
  getOneDriveProfileWithToken,
  syncOneDriveQuota,
} from "@/server/modules/onedrive/onedrive.service";
import {
  browseProviderFolder,
  ensureProviderChildFolder,
  syncProviderQuota,
} from "@/server/modules/providers/operations";
import { ensureDropboxWebhookCursor } from "@/server/modules/webhooks/dropbox-notify";
import {
  ensureGoogleDriveWatch,
  stopGoogleDriveWatches,
} from "@/server/modules/webhooks/google-drive-watch";
import {
  decryptText,
  encryptText,
  hashToken,
  randomToken,
} from "@/server/utils/crypto";

export const GOOGLE_CONNECT_RETURN_COOKIE = "archivecloud_oauth_return";

function safeAppPath(path: string | null | undefined): string | null {
  if (!path?.startsWith("/") || path.startsWith("//")) return null;
  return path;
}

export async function createGoogleConnectUrl(
  userId: string,
  request: Request,
  options?: { loginHint?: string },
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
    ...(options?.loginHint ? { login_hint: options.loginHint } : {}),
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
  for (const account of missingQuota) {
    await syncProviderQuota(account).catch(() => undefined);
  }

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

export async function createOneDriveConnectUrl(
  userId: string,
): Promise<string | Response> {
  const config = await ensureGlobalOneDriveProviderConfig();
  if (!config) {
    return errorJson(
      "ONEDRIVE_NOT_CONFIGURED",
      "OneDrive is not configured yet. Add ONEDRIVE_CLIENT_ID and ONEDRIVE_CLIENT_SECRET to .env.",
      503,
    );
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

  return buildOneDriveAuthUrl({
    clientId: decryptText(config.clientIdEncrypted),
    redirectUri: config.redirectUri,
    state,
    scopes: config.scopes as string[],
  });
}

export async function onedriveConnectUrlHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const url = await createOneDriveConnectUrl(user.id);
  if (url instanceof Response) return url;
  return oauthConnectStartResponse(request, url);
}

export async function onedriveCallbackHandler(request: Request) {
  try {
    const url = new URL(request.url);
    const query = z
      .object({ code: z.string(), state: z.string() })
      .parse(Object.fromEntries(url.searchParams));
    const oauthState = await prisma.oauthState.findUniqueOrThrow({
      where: { stateHash: hashToken(query.state) },
      include: { providerConfig: true },
    });
    if (oauthState.usedAt || oauthState.expiresAt < new Date()) {
      return NextResponse.redirect(
        `${env.APP_URL}/onedrive-connected?status=error&reason=state_expired`,
      );
    }
    if (oauthState.flow !== "connect" || !oauthState.userId) {
      return NextResponse.redirect(
        `${env.APP_URL}/onedrive-connected?status=error&reason=state_invalid`,
      );
    }

    const sessionUser = await requireAuthUser(request);
    if (sessionUser instanceof Response) {
      await prisma.oauthState.update({
        where: { id: oauthState.id },
        data: { usedAt: new Date() },
      });
      return NextResponse.redirect(
        `${env.APP_URL}/onedrive-connected?status=error&reason=auth_required`,
      );
    }
    if (sessionUser.id !== oauthState.userId) {
      await prisma.oauthState.update({
        where: { id: oauthState.id },
        data: { usedAt: new Date() },
      });
      return NextResponse.redirect(
        `${env.APP_URL}/onedrive-connected?status=error&reason=session_mismatch`,
      );
    }

    const tokens = await exchangeOneDriveCode({
      config: oauthState.providerConfig,
      code: query.code,
    });
    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(
        `${env.APP_URL}/onedrive-connected?status=error&reason=tokens`,
      );
    }

    const profile = await getOneDriveProfileWithToken(tokens.access_token);
    const providerAccountId = profile.id;
    const email = profile.mail || profile.userPrincipalName;
    if (!providerAccountId || !email) {
      return NextResponse.redirect(
        `${env.APP_URL}/onedrive-connected?status=error&reason=profile`,
      );
    }

    const account = await prisma.connectedAccount.upsert({
      where: {
        userId_provider_providerAccountId: {
          userId: oauthState.userId,
          provider: "onedrive",
          providerAccountId,
        },
      },
      create: {
        userId: oauthState.userId,
        providerConfigId: oauthState.providerConfigId,
        provider: "onedrive",
        providerAccountId,
        email,
        displayName: profile.displayName ?? null,
        avatarUrl: null,
        accessTokenEncrypted: encryptText(tokens.access_token),
        refreshTokenEncrypted: encryptText(tokens.refresh_token),
        tokenExpiresAt: new Date(
          Date.now() + (tokens.expires_in ?? 3600) * 1000,
        ),
        scopes: oauthState.providerConfig.scopes as string[],
        status: "connected",
      },
      update: {
        providerConfigId: oauthState.providerConfigId,
        email,
        displayName: profile.displayName ?? null,
        accessTokenEncrypted: encryptText(tokens.access_token),
        refreshTokenEncrypted: encryptText(tokens.refresh_token),
        tokenExpiresAt: new Date(
          Date.now() + (tokens.expires_in ?? 3600) * 1000,
        ),
        scopes: oauthState.providerConfig.scopes as string[],
        status: "connected",
      },
    });

    await prisma.oauthState.update({
      where: { id: oauthState.id },
      data: { usedAt: new Date() },
    });
    await syncOneDriveQuota(account.id);
    try {
      const { ensureOneDriveSubscription } = await import(
        "@/server/modules/webhooks/onedrive-subscription"
      );
      await ensureOneDriveSubscription(account);
    } catch (error) {
      console.error("OneDrive subscription registration failed:", error);
    }
    return NextResponse.redirect(
      `${env.APP_URL}/onedrive-connected?status=success`,
    );
  } catch (error) {
    console.error("OneDrive OAuth callback failed:", error);
    return NextResponse.redirect(
      `${env.APP_URL}/onedrive-connected?status=error`,
    );
  }
}

export async function createDropboxConnectUrl(
  userId: string,
): Promise<string | Response> {
  const config = await ensureGlobalDropboxProviderConfig();
  if (!config) {
    return errorJson(
      "DROPBOX_NOT_CONFIGURED",
      "Dropbox is not configured yet. Add DROPBOX_CLIENT_ID and DROPBOX_CLIENT_SECRET to .env.",
      503,
    );
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

  return buildDropboxAuthUrl({
    clientId: decryptText(config.clientIdEncrypted),
    redirectUri: config.redirectUri,
    state,
    scopes: config.scopes as string[],
  });
}

export async function dropboxConnectUrlHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const url = await createDropboxConnectUrl(user.id);
  if (url instanceof Response) return url;
  return oauthConnectStartResponse(request, url);
}

export async function dropboxCallbackHandler(request: Request) {
  try {
    const url = new URL(request.url);
    const query = z
      .object({ code: z.string(), state: z.string() })
      .parse(Object.fromEntries(url.searchParams));
    const oauthState = await prisma.oauthState.findUniqueOrThrow({
      where: { stateHash: hashToken(query.state) },
      include: { providerConfig: true },
    });
    if (oauthState.usedAt || oauthState.expiresAt < new Date()) {
      return NextResponse.redirect(
        `${env.APP_URL}/dropbox-connected?status=error&reason=state_expired`,
      );
    }
    if (oauthState.flow !== "connect" || !oauthState.userId) {
      return NextResponse.redirect(
        `${env.APP_URL}/dropbox-connected?status=error&reason=state_invalid`,
      );
    }

    const sessionUser = await requireAuthUser(request);
    if (sessionUser instanceof Response) {
      await prisma.oauthState.update({
        where: { id: oauthState.id },
        data: { usedAt: new Date() },
      });
      return NextResponse.redirect(
        `${env.APP_URL}/dropbox-connected?status=error&reason=auth_required`,
      );
    }
    if (sessionUser.id !== oauthState.userId) {
      await prisma.oauthState.update({
        where: { id: oauthState.id },
        data: { usedAt: new Date() },
      });
      return NextResponse.redirect(
        `${env.APP_URL}/dropbox-connected?status=error&reason=session_mismatch`,
      );
    }

    const tokens = await exchangeDropboxCode({
      config: oauthState.providerConfig,
      code: query.code,
    });
    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(
        `${env.APP_URL}/dropbox-connected?status=error&reason=tokens`,
      );
    }

    const profile = await getDropboxAccountProfileWithToken(
      tokens.access_token,
    );
    const providerAccountId =
      profile.account_id || tokens.account_id || tokens.uid;
    const email = profile.email;
    if (!providerAccountId || !email) {
      return NextResponse.redirect(
        `${env.APP_URL}/dropbox-connected?status=error&reason=profile`,
      );
    }

    const account = await prisma.connectedAccount.upsert({
      where: {
        userId_provider_providerAccountId: {
          userId: oauthState.userId,
          provider: "dropbox",
          providerAccountId,
        },
      },
      create: {
        userId: oauthState.userId,
        providerConfigId: oauthState.providerConfigId,
        provider: "dropbox",
        providerAccountId,
        email,
        displayName: profile.name?.display_name ?? null,
        avatarUrl: profile.profile_photo_url ?? null,
        accessTokenEncrypted: encryptText(tokens.access_token),
        refreshTokenEncrypted: encryptText(tokens.refresh_token),
        tokenExpiresAt: new Date(
          Date.now() + (tokens.expires_in ?? 14400) * 1000,
        ),
        scopes: oauthState.providerConfig.scopes as string[],
        status: "connected",
      },
      update: {
        providerConfigId: oauthState.providerConfigId,
        email,
        displayName: profile.name?.display_name ?? null,
        avatarUrl: profile.profile_photo_url ?? null,
        accessTokenEncrypted: encryptText(tokens.access_token),
        refreshTokenEncrypted: encryptText(tokens.refresh_token),
        tokenExpiresAt: new Date(
          Date.now() + (tokens.expires_in ?? 14400) * 1000,
        ),
        scopes: oauthState.providerConfig.scopes as string[],
        status: "connected",
      },
    });

    await prisma.oauthState.update({
      where: { id: oauthState.id },
      data: { usedAt: new Date() },
    });
    try {
      await syncDropboxQuota(account.id);
    } catch (error) {
      console.error("Dropbox quota sync failed:", error);
    }
    try {
      await ensureDropboxWebhookCursor(account.id, account.providerAccountId);
    } catch (error) {
      console.error("Dropbox webhook cursor setup failed:", error);
    }
    return NextResponse.redirect(
      `${env.APP_URL}/dropbox-connected?status=success`,
    );
  } catch (error) {
    console.error("Dropbox OAuth callback failed:", error);
    return NextResponse.redirect(
      `${env.APP_URL}/dropbox-connected?status=error`,
    );
  }
}

export async function googleConnectUrlHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const url = await createGoogleConnectUrl(user.id, request);
  if (url instanceof Response) return url;
  return oauthConnectStartResponse(request, url);
}

export async function googleConnectHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  const requestUrl = new URL(request.url);
  const returnTo = safeAppPath(requestUrl.searchParams.get("returnTo"));
  const loginHintParam = requestUrl.searchParams.get("login_hint")?.trim();
  const userRow = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true },
  });
  const loginHint = loginHintParam || userRow?.email || undefined;

  const url = await createGoogleConnectUrl(user.id, request, { loginHint });
  if (url instanceof Response) return url;

  const response = NextResponse.redirect(url);
  if (returnTo) {
    response.cookies.set(GOOGLE_CONNECT_RETURN_COOKIE, returnTo, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
      secure: env.APP_URL.startsWith("https://"),
    });
  }
  return response;
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

    if (oauthState.flow !== "connect" || !oauthState.userId)
      return errorJson(
        "GOOGLE_OAUTH_STATE_INVALID",
        "OAuth state expired.",
        400,
      );

    const sessionUser = await requireAuthUser(request);
    if (sessionUser instanceof Response) {
      await prisma.oauthState.update({
        where: { id: oauthState.id },
        data: { usedAt: new Date() },
      });
      return NextResponse.redirect(
        `${env.APP_URL}/google-connected?status=error&reason=auth_required`,
      );
    }
    if (sessionUser.id !== oauthState.userId) {
      await prisma.oauthState.update({
        where: { id: oauthState.id },
        data: { usedAt: new Date() },
      });
      return NextResponse.redirect(
        `${env.APP_URL}/google-connected?status=error&reason=session_mismatch`,
      );
    }

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
    try {
      await ensureGoogleDriveWatch(account);
    } catch (error) {
      console.error("Google Drive watch registration failed:", error);
    }

    const cookieStore = await cookies();
    const returnTo = safeAppPath(
      cookieStore.get(GOOGLE_CONNECT_RETURN_COOKIE)?.value,
    );
    cookieStore.delete(GOOGLE_CONNECT_RETURN_COOKIE);

    if (returnTo) {
      const dest = new URL(returnTo, env.APP_URL);
      dest.searchParams.set("googleDrive", "connected");
      return NextResponse.redirect(dest.toString());
    }

    return NextResponse.redirect(
      `${env.APP_URL}/google-connected?status=success`,
    );
  } catch (error) {
    console.error("Google OAuth callback failed:", error);
    try {
      const cookieStore = await cookies();
      const returnTo = safeAppPath(
        cookieStore.get(GOOGLE_CONNECT_RETURN_COOKIE)?.value,
      );
      cookieStore.delete(GOOGLE_CONNECT_RETURN_COOKIE);
      if (returnTo) {
        const dest = new URL(returnTo, env.APP_URL);
        dest.searchParams.set("googleDrive", "error");
        return NextResponse.redirect(dest.toString());
      }
    } catch {
    }
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
  try {
    const quota = await syncProviderQuota(account);
    return json({ quota: serializeStorageAccount(quota) });
  } catch (error) {
    return errorJson(
      "UNSUPPORTED_PROVIDER",
      error instanceof Error
        ? error.message
        : "Quota sync is not supported for this provider.",
      400,
    );
  }
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
  try {
    await stopGoogleDriveWatches(accountId);
  } catch (error) {
    console.error("Failed to stop Google Drive watches:", error);
  }
  try {
    const { stopOneDriveSubscriptions } = await import(
      "@/server/modules/webhooks/onedrive-subscription"
    );
    await stopOneDriveSubscriptions(accountId);
  } catch (error) {
    console.error("Failed to stop OneDrive subscriptions:", error);
  }
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

  try {
    const result = await browseProviderFolder(
      account,
      user.id,
      parentId,
      query.q,
    );
    return json(result);
  } catch (error) {
    return errorJson(
      "UNSUPPORTED_PROVIDER",
      error instanceof Error
        ? error.message
        : "Browsing is not supported for this provider.",
      400,
    );
  }
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

  if (
    account.provider === "google_drive" ||
    account.provider === "google_shared_drive"
  ) {
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
      if (account.provider === "google_drive") {
        return streamGoogleDriveThumbnailResponse(account, providerFileId);
      }
    }

    return streamGoogleProviderFileResponse(
      account,
      { providerFileId, mimeType, name },
      range,
      { disposition: "inline" },
    );
  }

  try {
    const { pullProviderFile } = await import(
      "@/server/modules/providers/operations"
    );
    const pulled = await pullProviderFile(account, providerFileId);
    const canInline =
      pulled.mimeType.startsWith("image/") ||
      pulled.mimeType === "application/pdf" ||
      pulled.mimeType.startsWith("text/") ||
      pulled.mimeType.startsWith("audio/") ||
      pulled.mimeType.startsWith("video/");
    const disposition = canInline ? "inline" : "attachment";
    const encodedName = encodeURIComponent(pulled.name).replace(
      /['()]/g,
      escape,
    );
    return new Response(Readable.toWeb(pulled.stream) as ReadableStream, {
      headers: {
        "Content-Type": pulled.mimeType || "application/octet-stream",
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodedName}`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    return errorJson(
      "PREVIEW_FAILED",
      error instanceof Error ? error.message : "Preview failed.",
      400,
    );
  }
}

export async function downloadConnectedAccountFileHandler(
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

  if (
    account.provider === "google_drive" ||
    account.provider === "google_shared_drive"
  ) {
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
    return streamGoogleProviderFileResponse(
      account,
      { providerFileId, mimeType, name },
      range,
      { disposition: "attachment" },
    );
  }

  try {
    const { pullProviderFile } = await import(
      "@/server/modules/providers/operations"
    );
    const pulled = await pullProviderFile(account, providerFileId);
    const encodedName = encodeURIComponent(pulled.name).replace(
      /['()]/g,
      escape,
    );
    return new Response(Readable.toWeb(pulled.stream) as ReadableStream, {
      headers: {
        "Content-Type": pulled.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    return errorJson(
      "DOWNLOAD_FAILED",
      error instanceof Error ? error.message : "Download failed.",
      400,
    );
  }
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

export async function renameConnectedAccountItemHandler(
  request: Request,
  _user?: AuthUser,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const accountId = params?.id;
  const itemId = params?.itemId;
  if (!accountId || !itemId) {
    return errorJson("VALIDATION_ERROR", "Account and item id required.", 400);
  }

  const body = z
    .object({ name: z.string().trim().min(1).max(255) })
    .parse(await request.json());

  const account = await prisma.connectedAccount.findFirst({
    where: { id: accountId, userId: user.id, status: "connected" },
  });
  if (!account) {
    return errorJson("ACCOUNT_NOT_FOUND", "Connected account not found.", 404);
  }

  try {
    const { renameProviderFile } = await import(
      "@/server/modules/providers/operations"
    );
    const renamed = await renameProviderFile({
      account,
      providerFileId: itemId,
      newName: body.name,
    });
    return json({ item: renamed });
  } catch (error) {
    return errorJson(
      "RENAME_FAILED",
      error instanceof Error ? error.message : "Rename failed.",
      400,
    );
  }
}

export async function createConnectedAccountFolderHandler(
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

  const body = z
    .object({
      name: z.string().trim().min(1).max(255),
      parentId: z.string().optional(),
    })
    .parse(await request.json());

  const account = await prisma.connectedAccount.findFirst({
    where: { id: accountId, userId: user.id, status: "connected" },
  });
  if (!account) {
    return errorJson("ACCOUNT_NOT_FOUND", "Connected account not found.", 404);
  }

  try {
    const parentId = body.parentId?.trim() || "root";
    const folderId = await ensureProviderChildFolder(
      account,
      parentId,
      body.name,
    );
    return json({ folder: { id: folderId, name: body.name } }, 201);
  } catch (error) {
    return errorJson(
      "CREATE_FOLDER_FAILED",
      error instanceof Error ? error.message : "Failed to create folder.",
      400,
    );
  }
}

export async function deleteConnectedAccountItemHandler(
  request: Request,
  _user?: AuthUser,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const accountId = params?.id;
  const itemId = params?.itemId;
  if (!accountId || !itemId) {
    return errorJson("VALIDATION_ERROR", "Account and item id required.", 400);
  }

  const account = await prisma.connectedAccount.findFirst({
    where: { id: accountId, userId: user.id, status: "connected" },
  });
  if (!account) {
    return errorJson("ACCOUNT_NOT_FOUND", "Connected account not found.", 404);
  }

  try {
    const { deleteProviderFile } = await import(
      "@/server/modules/providers/operations"
    );
    await deleteProviderFile({ account, providerFileId: itemId });
    return json({ status: "ok" });
  } catch (error) {
    return errorJson(
      "DELETE_FAILED",
      error instanceof Error ? error.message : "Delete failed.",
      400,
    );
  }
}
