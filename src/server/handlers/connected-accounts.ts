import { google } from "googleapis";
import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/server/config/env";
import { prisma } from "@/server/config/prisma";
import { type AuthUser, requireAuthUser } from "@/server/http/auth";
import { errorJson, json } from "@/server/http/responses";
import {
  createOAuthClient,
  ensureGlobalGoogleProviderConfig,
  syncGoogleQuota,
} from "@/server/modules/google/google.service";
import { syncS3Quota, testS3Connection } from "@/server/modules/s3/s3.service";
import { encryptText, hashToken, randomToken } from "@/server/utils/crypto";

const s3ConnectSchema = z.object({
  name: z.string().trim().min(1).max(191),
  bucket: z.string().trim().min(1).max(191),
  region: z.string().trim().min(1).max(191),
  endpoint: z.string().url().optional().or(z.literal("")),
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
  forcePathStyle: z.boolean().optional(),
  quotaBytes: z.string().regex(/^\d+$/).optional().nullable(),
});

async function syncQuotaForAccount(account: { id: string; provider: string }) {
  if (account.provider === "s3") return syncS3Quota(account.id);
  return syncGoogleQuota(account.id);
}

export async function createGoogleConnectUrl(
  userId: string,
  request: Request,
): Promise<string | Response> {
  const url = new URL(request.url);
  const query = z
    .object({ providerConfigId: z.string().min(1).optional() })
    .parse(Object.fromEntries(url.searchParams));

  let config;
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
        "Google Drive is not configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env, or set up OAuth in Developer Console.",
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
    await syncQuotaForAccount(account).catch(() => undefined);

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
          ? {
              ...storageAccount,
              totalBytes: storageAccount.totalBytes?.toString() ?? null,
              usedBytes: storageAccount.usedBytes.toString(),
              availableBytes: storageAccount.availableBytes?.toString() ?? null,
              trashBytes: storageAccount.trashBytes?.toString() ?? null,
            }
          : null,
      }),
    ),
  });
}

export async function connectS3Handler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const body = s3ConnectSchema.parse(await request.json());
  const providerConfig = await ensureGlobalGoogleProviderConfig();
  const providerConfigId = providerConfig?.id ?? null;
  const providerAccountId = `${body.bucket}:${body.endpoint || body.region}`;
  const existingAccount = await prisma.connectedAccount.findUnique({
    where: {
      userId_provider_providerAccountId: {
        userId: user.id,
        provider: "s3",
        providerAccountId,
      },
    },
  });
  const account = existingAccount
    ? await prisma.connectedAccount.update({
        where: { id: existingAccount.id },
        data: {
          providerConfigId,
          email: `${body.bucket} (S3)`,
          displayName: body.name,
          accessTokenEncrypted: encryptText("s3"),
          refreshTokenEncrypted: encryptText(randomToken()),
          tokenExpiresAt: new Date(
            Date.now() + 100 * 365 * 24 * 60 * 60 * 1000,
          ),
          scopes: [],
          status: "connected",
        },
      })
    : await prisma.connectedAccount.create({
        data: {
          userId: user.id,
          providerConfigId,
          provider: "s3",
          providerAccountId,
          email: `${body.bucket} (S3)`,
          displayName: body.name,
          accessTokenEncrypted: encryptText("s3"),
          refreshTokenEncrypted: encryptText(randomToken()),
          tokenExpiresAt: new Date(
            Date.now() + 100 * 365 * 24 * 60 * 60 * 1000,
          ),
          scopes: [],
          status: "connected",
        },
      });
  const config = await prisma.s3StorageConfig.upsert({
    where: { connectedAccountId: account.id },
    create: {
      userId: user.id,
      connectedAccountId: account.id,
      name: body.name,
      bucket: body.bucket,
      region: body.region,
      endpoint: body.endpoint || null,
      accessKeyIdEncrypted: encryptText(body.accessKeyId),
      secretAccessKeyEncrypted: encryptText(body.secretAccessKey),
      forcePathStyle: body.forcePathStyle ?? Boolean(body.endpoint),
      quotaBytes: body.quotaBytes ? BigInt(body.quotaBytes) : null,
    },
    update: {
      name: body.name,
      bucket: body.bucket,
      region: body.region,
      endpoint: body.endpoint || null,
      accessKeyIdEncrypted: encryptText(body.accessKeyId),
      secretAccessKeyEncrypted: encryptText(body.secretAccessKey),
      forcePathStyle: body.forcePathStyle ?? Boolean(body.endpoint),
      quotaBytes: body.quotaBytes ? BigInt(body.quotaBytes) : null,
      status: "active",
    },
  });
  try {
    await testS3Connection(config);
    const quota = await syncS3Quota(account.id);
    return json(
      {
        account: {
          ...account,
          storageAccount: {
            ...quota,
            totalBytes: quota.totalBytes?.toString() ?? null,
            usedBytes: quota.usedBytes.toString(),
            availableBytes: quota.availableBytes?.toString() ?? null,
            trashBytes: quota.trashBytes?.toString() ?? null,
          },
        },
      },
      201,
    );
  } catch (error) {
    if (!existingAccount)
      await prisma.connectedAccount
        .delete({ where: { id: account.id } })
        .catch(() => undefined);
    throw error;
  }
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
  const quota = await syncQuotaForAccount(account);
  return json({
    quota: {
      ...quota,
      totalBytes: quota.totalBytes?.toString() ?? null,
      usedBytes: quota.usedBytes.toString(),
      availableBytes: quota.availableBytes?.toString() ?? null,
      trashBytes: quota.trashBytes?.toString() ?? null,
    },
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
