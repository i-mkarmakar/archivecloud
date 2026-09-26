import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/server/config/env";
import { prisma } from "@/server/config/prisma";
import { requireAuthUser } from "@/server/http/auth";
import {
  clearConnectAliasCookie,
  defaultProviderAlias,
  normalizeConnectAlias,
  oauthStateFromAuthUrl,
  parseConnectAliasParam,
  readConnectAliasFromRequest,
  resolveConnectedAccountAlias,
} from "@/server/http/connect-alias";
import { oauthConnectStartResponse } from "@/server/http/oauth-connect-response";
import { errorJson, json } from "@/server/http/responses";
import {
  connectICloudAccount,
  syncICloudQuota,
} from "@/server/modules/icloud/icloud.service";
import {
  buildPCloudAuthUrl,
  buildPCloudScopes,
  ensureGlobalPCloudProviderConfig,
  exchangePCloudCode,
  getPCloudAccountInfoWithToken,
  resolvePCloudUserId,
  syncPCloudQuota,
} from "@/server/modules/pcloud/pcloud.service";
import {
  buildGooglePhotosAuthUrl,
  ensureGlobalGooglePhotosProviderConfig,
  exchangeGooglePhotosCode,
  getGooglePhotosProfileWithTokens,
  syncGooglePhotosQuota,
} from "@/server/modules/providers/google/google-photos.service";
import {
  buildGoogleSharedDriveAuthUrl,
  connectSharedDriveFromGoogleAccount,
  ensureGlobalGoogleSharedDriveProviderConfig,
  exchangeGoogleSharedDriveCode,
  getGoogleSharedDriveProfileWithTokens,
  listSharedDrivesWithTokens,
  syncGoogleSharedDriveQuota,
} from "@/server/modules/providers/google/google-shared-drive.service";
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

async function createPCloudConnectUrl(
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
  const alias = parseConnectAliasParam(request);
  const url = await createPCloudConnectUrl(user.id);
  if (url instanceof Response) return url;
  return oauthConnectStartResponse(request, url, {
    state: oauthStateFromAuthUrl(url),
    alias,
  });
}

export async function pcloudCallbackHandler(request: Request) {
  const redirectBase = `${env.APP_URL}/pcloud-connected`;
  try {
    const url = new URL(request.url);
    const query = z
      .object({
        code: z.string(),
        state: z.string(),
        hostname: z.string().optional(),
        locationid: z.string().optional(),
      })
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

    const hostname =
      query.hostname?.trim().toLowerCase() ||
      (query.locationid === "2" ? "eapi.pcloud.com" : "api.pcloud.com");
    const apiBase =
      hostname === "eapi.pcloud.com"
        ? "https://eapi.pcloud.com"
        : "https://api.pcloud.com";

    const tokens = await exchangePCloudCode({
      config: oauthState.providerConfig,
      code: query.code,
    });
    if (!tokens.access_token) {
      return NextResponse.redirect(
        `${redirectBase}?status=error&reason=tokens`,
      );
    }

    // Subsequent calls must use hostname from authorize redirect
    // (api.pcloud.com US / eapi.pcloud.com EU) per pCloud OAuth docs.
    const info = await getPCloudAccountInfoWithToken({
      accessToken: tokens.access_token,
      apiBase,
    });
    const providerAccountId =
      resolvePCloudUserId(tokens) ||
      resolvePCloudUserId({ userid: info.userid });
    if (!providerAccountId) {
      console.error("pCloud profile missing userid", {
        tokenKeys: Object.keys(tokens),
        infoKeys: Object.keys(info ?? {}),
        hostname,
      });
      return NextResponse.redirect(
        `${redirectBase}?status=error&reason=profile`,
      );
    }

    const email =
      info.email?.trim() || `pcloud-${providerAccountId}@users.pcloud`;
    const scopes = buildPCloudScopes({
      existingScopes: oauthState.providerConfig.scopes,
      apiBase,
    });

    const existingAccount = await prisma.connectedAccount.findUnique({
      where: {
        userId_provider_providerAccountId: {
          userId: oauthState.userId,
          provider: "pcloud",
          providerAccountId,
        },
      },
      select: { displayName: true },
    });
    const displayName = resolveConnectedAccountAlias({
      request,
      state: query.state,
      provider: "pcloud",
      existingDisplayName: existingAccount?.displayName,
    });

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
        email,
        displayName,
        accessTokenEncrypted: encryptText(tokens.access_token),
        refreshTokenEncrypted: tokens.refresh_token
          ? encryptText(tokens.refresh_token)
          : null,
        tokenExpiresAt: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000)
          : null,
        scopes,
        status: "connected",
      },
      update: {
        providerConfigId: oauthState.providerConfigId,
        email,
        displayName,
        accessTokenEncrypted: encryptText(tokens.access_token),
        refreshTokenEncrypted: tokens.refresh_token
          ? encryptText(tokens.refresh_token)
          : undefined,
        tokenExpiresAt: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000)
          : null,
        scopes,
        status: "connected",
      },
    });

    await prisma.oauthState.update({
      where: { id: oauthState.id },
      data: { usedAt: new Date() },
    });
    await syncPCloudQuota(account.id);
    const success = NextResponse.redirect(`${redirectBase}?status=success`);
    clearConnectAliasCookie(success);
    return success;
  } catch (error) {
    console.error("pCloud OAuth callback failed:", error);
    return NextResponse.redirect(`${redirectBase}?status=error`);
  }
}

async function createGooglePhotosConnectUrl(
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
  const alias = parseConnectAliasParam(request);
  const url = await createGooglePhotosConnectUrl(user.id);
  if (url instanceof Response) return url;
  return oauthConnectStartResponse(request, url, {
    state: oauthStateFromAuthUrl(url),
    alias,
  });
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

    const displayName = resolveConnectedAccountAlias({
      request,
      state: query.state,
      provider: "google_photos",
      existingDisplayName: existingAccount?.displayName,
    });

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
        displayName,
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
        displayName,
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
    const success = NextResponse.redirect(
      `${redirectBase}?status=success&accountId=${encodeURIComponent(account.id)}`,
    );
    clearConnectAliasCookie(success);
    return success;
  } catch (error) {
    console.error("Google Photos OAuth callback failed:", error);
    return NextResponse.redirect(`${redirectBase}?status=error`);
  }
}

async function createGoogleSharedDriveConnectUrl(
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
  const alias = parseConnectAliasParam(request);
  const url = await createGoogleSharedDriveConnectUrl(user.id);
  if (url instanceof Response) return url;
  return oauthConnectStartResponse(request, url, {
    state: oauthStateFromAuthUrl(url),
    alias,
  });
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
    const baseAlias = readConnectAliasFromRequest(request, query.state);

    for (const sharedDrive of sharedDrives) {
      const driveLabel = sharedDrive.name.trim() || "Shared Drive";
      const displayName = baseAlias
        ? sharedDrives.length === 1
          ? baseAlias
          : `${baseAlias} · ${driveLabel}`
        : driveLabel;
      const account = await connectSharedDriveFromGoogleAccount({
        userId: oauthState.userId,
        providerConfigId: oauthState.providerConfigId,
        sharedDriveId: sharedDrive.id,
        sharedDriveName: displayName,
        email: profile.email,
        displayName,
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
    const success = NextResponse.redirect(`${redirectBase}?status=success`);
    clearConnectAliasCookie(success);
    return success;
  } catch (error) {
    console.error("Google Shared Drive OAuth callback failed:", error);
    return NextResponse.redirect(`${redirectBase}?status=error`);
  }
}

const icloudConnectSchema = z.object({
  appleId: z.string().email(),
  appSpecificPassword: z.string().min(1),
  provider: z.enum(["icloud_drive", "icloud_photos"]),
  alias: z.string().trim().min(1).max(50).optional(),
});

export async function connectICloudHandler(request: Request) {
  try {
    const user = await requireAuthUser(request);
    if (user instanceof Response) return user;

    const body = icloudConnectSchema.parse(await request.json());
    const alias =
      normalizeConnectAlias(body.alias) ?? defaultProviderAlias(body.provider);
    const account = await connectICloudAccount(user.id, {
      appleId: body.appleId,
      appSpecificPassword: body.appSpecificPassword,
      provider: body.provider,
      displayName: alias,
    });
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
