import { google } from "googleapis";
import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/server/config/env";
import { prisma } from "@/server/config/prisma";
import { requireAuthUser } from "@/server/http/auth";
import { oauthConnectStartResponse } from "@/server/http/oauth-connect-response";
import { errorJson, json } from "@/server/http/responses";
import { createOAuthClient } from "@/server/modules/google/google.service";
import {
  buildGooglePhotosAuthUrl,
  ensureGlobalGooglePhotosProviderConfig,
  exchangeGooglePhotosCode,
  getGooglePhotosProfileWithTokens,
  syncGooglePhotosQuota,
} from "@/server/modules/google/google-photos.service";
import {
  buildGoogleSharedDriveAuthUrl,
  connectSharedDriveFromGoogleAccount,
  ensureGlobalGoogleSharedDriveProviderConfig,
  exchangeGoogleSharedDriveCode,
  getGoogleSharedDriveProfileWithTokens,
  syncGoogleSharedDriveQuota,
} from "@/server/modules/google/google-shared-drive.service";
import {
  connectICloudAccount,
  syncICloudQuota,
} from "@/server/modules/icloud/icloud.service";
import {
  buildPCloudAuthUrl,
  ensureGlobalPCloudProviderConfig,
  exchangePCloudCode,
  getPCloudAccountInfo,
  syncPCloudQuota,
} from "@/server/modules/pcloud/pcloud.service";
import { ensureGoogleDriveWatch } from "@/server/modules/webhooks/google-drive-watch";
import {
  decryptText,
  encryptText,
  hashToken,
  randomToken,
} from "@/server/utils/crypto";

function credentialAccountResponse(account: {
  id: string;
  provider: string;
  email: string;
  displayName: string | null;
  status: string;
}) {
  return json({
    account: {
      id: account.id,
      provider: account.provider,
      email: account.email,
      displayName: account.displayName,
      status: account.status,
    },
  });
}

async function validateOAuthCallbackSession(
  request: Request,
  oauthState: { id: string; userId: string | null },
  redirectBase: string,
) {
  const sessionUser = await requireAuthUser(request);
  if (sessionUser instanceof Response) {
    await prisma.oauthState.update({
      where: { id: oauthState.id },
      data: { usedAt: new Date() },
    });
    return NextResponse.redirect(
      `${redirectBase}?status=error&reason=auth_required`,
    );
  }
  if (sessionUser.id !== oauthState.userId) {
    await prisma.oauthState.update({
      where: { id: oauthState.id },
      data: { usedAt: new Date() },
    });
    return NextResponse.redirect(
      `${redirectBase}?status=error&reason=session_mismatch`,
    );
  }
  return sessionUser;
}

export async function createPCloudConnectUrl(
  userId: string,
): Promise<string | Response> {
  const config = await ensureGlobalPCloudProviderConfig();
  if (!config) {
    return errorJson(
      "PCLOUD_NOT_CONFIGURED",
      "pCloud is not configured yet. Add PCLOUD_CLIENT_ID and PCLOUD_CLIENT_SECRET to .env.",
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

  return buildPCloudAuthUrl({
    clientId: decryptText(config.clientIdEncrypted),
    redirectUri: config.redirectUri,
    state,
  });
}

export async function pcloudConnectUrlHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const url = await createPCloudConnectUrl(user.id);
  if (url instanceof Response) return url;
  return oauthConnectStartResponse(request, url);
}

export async function pcloudCallbackHandler(request: Request) {
  const redirectBase = `${env.APP_URL}/pcloud-connected`;
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
        `${redirectBase}?status=error&reason=state_expired`,
      );
    }
    if (oauthState.flow !== "connect" || !oauthState.userId) {
      return NextResponse.redirect(
        `${redirectBase}?status=error&reason=state_invalid`,
      );
    }

    const sessionCheck = await validateOAuthCallbackSession(
      request,
      oauthState,
      redirectBase,
    );
    if (sessionCheck instanceof NextResponse) return sessionCheck;

    const tokens = await exchangePCloudCode({
      config: oauthState.providerConfig,
      code: query.code,
    });
    if (!tokens.access_token) {
      return NextResponse.redirect(
        `${redirectBase}?status=error&reason=tokens`,
      );
    }

    const providerAccountId = String(tokens.uid ?? "");
    if (!providerAccountId) {
      return NextResponse.redirect(
        `${redirectBase}?status=error&reason=profile`,
      );
    }

    const account = await prisma.connectedAccount.upsert({
      where: {
        userId_provider_providerAccountId: {
          userId: oauthState.userId,
          provider: "pcloud",
          providerAccountId,
        },
      },
      create: {
        userId: oauthState.userId,
        providerConfigId: oauthState.providerConfigId,
        provider: "pcloud",
        providerAccountId,
        email: "",
        accessTokenEncrypted: encryptText(tokens.access_token),
        refreshTokenEncrypted: tokens.refresh_token
          ? encryptText(tokens.refresh_token)
          : null,
        tokenExpiresAt: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000)
          : null,
        scopes: oauthState.providerConfig.scopes as string[],
        status: "connected",
      },
      update: {
        providerConfigId: oauthState.providerConfigId,
        accessTokenEncrypted: encryptText(tokens.access_token),
        refreshTokenEncrypted: tokens.refresh_token
          ? encryptText(tokens.refresh_token)
          : undefined,
        tokenExpiresAt: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000)
          : null,
        scopes: oauthState.providerConfig.scopes as string[],
        status: "connected",
      },
    });

    const info = await getPCloudAccountInfo(account);
    const email = info.email;
    if (!email) {
      return NextResponse.redirect(
        `${redirectBase}?status=error&reason=profile`,
      );
    }

    const updatedAccount = await prisma.connectedAccount.update({
      where: { id: account.id },
      data: { email },
    });

    await prisma.oauthState.update({
      where: { id: oauthState.id },
      data: { usedAt: new Date() },
    });
    await syncPCloudQuota(updatedAccount.id);
    return NextResponse.redirect(`${redirectBase}?status=success`);
  } catch (error) {
    console.error("pCloud OAuth callback failed:", error);
    return NextResponse.redirect(`${redirectBase}?status=error`);
  }
}

export async function createGooglePhotosConnectUrl(
  userId: string,
): Promise<string | Response> {
  const config = await ensureGlobalGooglePhotosProviderConfig();
  if (!config) {
    return errorJson(
      "GOOGLE_PHOTOS_NOT_CONFIGURED",
      "Google Photos is not configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.",
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

  return buildGooglePhotosAuthUrl({ config, state });
}

export async function googlePhotosConnectUrlHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const url = await createGooglePhotosConnectUrl(user.id);
  if (url instanceof Response) return url;
  return oauthConnectStartResponse(request, url);
}

export async function googlePhotosCallbackHandler(request: Request) {
  const redirectBase = `${env.APP_URL}/google-photos-connected`;
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
        `${redirectBase}?status=error&reason=state_expired`,
      );
    }
    if (oauthState.flow !== "connect" || !oauthState.userId) {
      return NextResponse.redirect(
        `${redirectBase}?status=error&reason=state_invalid`,
      );
    }

    const sessionCheck = await validateOAuthCallbackSession(
      request,
      oauthState,
      redirectBase,
    );
    if (sessionCheck instanceof NextResponse) return sessionCheck;

    const tokens = await exchangeGooglePhotosCode({
      config: oauthState.providerConfig,
      code: query.code,
    });
    if (!tokens.access_token) {
      return NextResponse.redirect(
        `${redirectBase}?status=error&reason=tokens`,
      );
    }

    const profile = await getGooglePhotosProfileWithTokens({
      config: oauthState.providerConfig,
      tokens,
    });
    const providerAccountId = profile.id;
    const email = profile.email;
    if (!providerAccountId || !email) {
      return NextResponse.redirect(
        `${redirectBase}?status=error&reason=profile`,
      );
    }

    const existingAccount = await prisma.connectedAccount.findUnique({
      where: {
        userId_provider_providerAccountId: {
          userId: oauthState.userId,
          provider: "google_photos",
          providerAccountId,
        },
      },
    });
    const refreshTokenEncrypted = tokens.refresh_token
      ? encryptText(tokens.refresh_token)
      : existingAccount?.refreshTokenEncrypted;
    if (!refreshTokenEncrypted) {
      return NextResponse.redirect(
        `${redirectBase}?status=error&reason=tokens`,
      );
    }

    const account = await prisma.connectedAccount.upsert({
      where: {
        userId_provider_providerAccountId: {
          userId: oauthState.userId,
          provider: "google_photos",
          providerAccountId,
        },
      },
      create: {
        userId: oauthState.userId,
        providerConfigId: oauthState.providerConfigId,
        provider: "google_photos",
        providerAccountId,
        email,
        displayName: profile.name ?? null,
        avatarUrl: profile.picture ?? null,
        accessTokenEncrypted: encryptText(tokens.access_token),
        refreshTokenEncrypted,
        tokenExpiresAt: new Date(tokens.expiry_date ?? Date.now() + 3600_000),
        scopes: oauthState.providerConfig.scopes as string[],
        status: "connected",
      },
      update: {
        providerConfigId: oauthState.providerConfigId,
        email,
        displayName: profile.name ?? null,
        avatarUrl: profile.picture ?? null,
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
    await syncGooglePhotosQuota(account.id);
    return NextResponse.redirect(`${redirectBase}?status=success`);
  } catch (error) {
    console.error("Google Photos OAuth callback failed:", error);
    return NextResponse.redirect(`${redirectBase}?status=error`);
  }
}

export async function createGoogleSharedDriveConnectUrl(
  userId: string,
): Promise<string | Response> {
  const config = await ensureGlobalGoogleSharedDriveProviderConfig();
  if (!config) {
    return errorJson(
      "GOOGLE_SHARED_DRIVE_NOT_CONFIGURED",
      "Google Shared Drive is not configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.",
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

  return buildGoogleSharedDriveAuthUrl({ config, state });
}

export async function googleSharedDriveConnectUrlHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const url = await createGoogleSharedDriveConnectUrl(user.id);
  if (url instanceof Response) return url;
  return oauthConnectStartResponse(request, url);
}

async function listSharedDrivesWithTokens(
  config: Parameters<typeof createOAuthClient>[0],
  tokens: {
    access_token?: string | null;
    refresh_token?: string | null;
    expiry_date?: number | null;
  },
) {
  const client = createOAuthClient(config);
  client.setCredentials(tokens);
  const drive = google.drive({ version: "v3", auth: client });
  const drives: Array<{ id: string; name: string }> = [];
  let pageToken: string | undefined;
  do {
    const response = await drive.drives.list({
      pageSize: 100,
      pageToken,
      fields: "nextPageToken,drives(id,name)",
    });
    for (const item of response.data.drives ?? []) {
      if (item.id && item.name) {
        drives.push({ id: item.id, name: item.name });
      }
    }
    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);
  return drives;
}

export async function googleSharedDriveCallbackHandler(request: Request) {
  const redirectBase = `${env.APP_URL}/google-shared-connected`;
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
        `${redirectBase}?status=error&reason=state_expired`,
      );
    }
    if (oauthState.flow !== "connect" || !oauthState.userId) {
      return NextResponse.redirect(
        `${redirectBase}?status=error&reason=state_invalid`,
      );
    }

    const sessionCheck = await validateOAuthCallbackSession(
      request,
      oauthState,
      redirectBase,
    );
    if (sessionCheck instanceof NextResponse) return sessionCheck;

    const tokens = await exchangeGoogleSharedDriveCode({
      config: oauthState.providerConfig,
      code: query.code,
    });
    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(
        `${redirectBase}?status=error&reason=tokens`,
      );
    }

    const profile = await getGoogleSharedDriveProfileWithTokens({
      config: oauthState.providerConfig,
      tokens,
    });
    if (!profile.email) {
      return NextResponse.redirect(
        `${redirectBase}?status=error&reason=profile`,
      );
    }

    const sharedDrives = await listSharedDrivesWithTokens(
      oauthState.providerConfig,
      tokens,
    );
    if (sharedDrives.length === 0) {
      await prisma.oauthState.update({
        where: { id: oauthState.id },
        data: { usedAt: new Date() },
      });
      return NextResponse.redirect(
        `${redirectBase}?status=error&reason=no_shared_drives`,
      );
    }

    const tokenExpiresAt = new Date(
      tokens.expiry_date ?? Date.now() + 3600_000,
    );
    const scopes = oauthState.providerConfig.scopes as string[];

    for (const sharedDrive of sharedDrives) {
      const account = await connectSharedDriveFromGoogleAccount({
        userId: oauthState.userId,
        providerConfigId: oauthState.providerConfigId,
        sharedDriveId: sharedDrive.id,
        sharedDriveName: sharedDrive.name,
        email: profile.email,
        displayName: profile.name,
        avatarUrl: profile.picture,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt,
        scopes,
      });
      await syncGoogleSharedDriveQuota(account.id);
      try {
        await ensureGoogleDriveWatch(account);
      } catch (error) {
        console.error("Google Shared Drive watch registration failed:", error);
      }
    }

    await prisma.oauthState.update({
      where: { id: oauthState.id },
      data: { usedAt: new Date() },
    });
    return NextResponse.redirect(`${redirectBase}?status=success`);
  } catch (error) {
    console.error("Google Shared Drive OAuth callback failed:", error);
    return NextResponse.redirect(`${redirectBase}?status=error`);
  }
}

const icloudConnectSchema = z.object({
  appleId: z.string().email(),
  appSpecificPassword: z.string().min(1),
  provider: z.enum(["icloud_drive", "icloud_photos"]),
});

export async function connectICloudHandler(request: Request) {
  try {
    const user = await requireAuthUser(request);
    if (user instanceof Response) return user;

    const body = icloudConnectSchema.parse(await request.json());
    const account = await connectICloudAccount(user.id, body);
    await syncICloudQuota(account.id);
    return credentialAccountResponse(account);
  } catch (error) {
    console.error("iCloud connect failed:", error);
    if (error instanceof z.ZodError) {
      return errorJson("VALIDATION_ERROR", "Invalid request body.", 400);
    }
    const message =
      error instanceof Error ? error.message : "Failed to connect iCloud.";
    return errorJson("ICLOUD_CONNECT_FAILED", message, 400);
  }
}
