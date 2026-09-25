import "server-only";

import { google } from "googleapis";
import type {
  ConnectedAccount,
  ProviderConfig,
} from "@/generated/prisma/client";
import { env } from "@/server/config/env";
import { prisma } from "@/server/config/prisma";
import {
  createOAuthClient,
  getAuthedGoogleClient,
} from "@/server/modules/providers/google/google.service";
import { GOOGLE_PHOTOS_PICKER_SCOPE } from "@/server/modules/providers/google/google-photos-picker.service";
import type { ProviderBrowseResult } from "@/server/modules/providers/types";
import { decryptText, encryptText } from "@/server/utils/crypto";

export const googlePhotosOAuthScopes = [
  GOOGLE_PHOTOS_PICKER_SCOPE,
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

function scopesEqual(a: unknown, b: string[]) {
  if (!Array.isArray(a) || a.length !== b.length) return false;
  return a.every((scope, index) => scope === b[index]);
}

function isConfiguredEnvValue(
  value: string | undefined,
  placeholders: string[],
) {
  if (!value?.trim()) return false;
  return !placeholders.includes(value.trim());
}

export async function ensureGlobalGooglePhotosProviderConfig(): Promise<ProviderConfig | null> {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = env.GOOGLE_PHOTOS_REDIRECT_URI;

  const hasClientId = isConfiguredEnvValue(clientId, [
    "your-google-client-id",
    "your-client-id",
    "build-google-client-id",
  ]);
  const hasClientSecret = isConfiguredEnvValue(clientSecret, [
    "your-google-client-secret",
    "your-client-secret",
    "build-google-client-secret",
  ]);
  if (!hasClientId || !hasClientSecret) return null;
  if (!clientId || !clientSecret) return null;

  const existing = await prisma.providerConfig.findFirst({
    where: { userId: null, provider: "google_photos", status: "active" },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    const needsUpdate =
      existing.redirectUri !== redirectUri ||
      decryptText(existing.clientIdEncrypted) !== clientId ||
      !scopesEqual(existing.scopes, googlePhotosOAuthScopes);
    if (needsUpdate) {
      return prisma.providerConfig.update({
        where: { id: existing.id },
        data: {
          redirectUri,
          clientIdEncrypted: encryptText(clientId),
          clientSecretEncrypted: encryptText(clientSecret),
          scopes: googlePhotosOAuthScopes,
        },
      });
    }
    return existing;
  }

  await prisma.providerConfig.updateMany({
    where: { userId: null, provider: "google_photos", status: "active" },
    data: { status: "disabled" },
  });

  return prisma.providerConfig.create({
    data: {
      userId: null,
      provider: "google_photos",
      clientIdEncrypted: encryptText(clientId),
      clientSecretEncrypted: encryptText(clientSecret),
      redirectUri,
      scopes: googlePhotosOAuthScopes,
      status: "active",
    },
  });
}

export function buildGooglePhotosAuthUrl(params: {
  config: ProviderConfig;
  state: string;
}) {
  const client = createOAuthClient(params.config);
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: params.config.scopes as string[],
    state: params.state,
  });
}

export async function exchangeGooglePhotosCode(params: {
  config: ProviderConfig;
  code: string;
}) {
  const client = createOAuthClient(params.config);
  const tokenResult = await client.getToken(params.code);
  return tokenResult.tokens;
}

type GooglePhotosProfile = {
  id: string;
  email: string;
  name?: string | null;
  picture?: string | null;
};

export async function getGooglePhotosProfile(
  account: ConnectedAccount,
): Promise<GooglePhotosProfile> {
  const auth = await getAuthedGoogleClient(account);
  const oauth2 = google.oauth2({ version: "v2", auth });
  const profile = await oauth2.userinfo.get();
  const id = profile.data.id;
  const email = profile.data.email;
  if (!id || !email) {
    throw new Error("Google Photos profile missing id or email.");
  }
  return {
    id,
    email,
    name: profile.data.name,
    picture: profile.data.picture,
  };
}

export async function getGooglePhotosProfileWithTokens(params: {
  config: ProviderConfig;
  tokens: {
    access_token?: string | null;
    refresh_token?: string | null;
    expiry_date?: number | null;
  };
}) {
  const client = createOAuthClient(params.config);
  client.setCredentials(params.tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const profile = await oauth2.userinfo.get();
  const id = profile.data.id;
  const email = profile.data.email;
  if (!id || !email) {
    throw new Error("Google Photos profile missing id or email.");
  }
  return {
    id,
    email,
    name: profile.data.name,
    picture: profile.data.picture,
  };
}

export async function syncGooglePhotosQuota(accountId: string) {
  return prisma.storageAccount.upsert({
    where: { connectedAccountId: accountId },
    create: {
      connectedAccountId: accountId,
      totalBytes: null,
      usedBytes: 0n,
      availableBytes: null,
      lastSyncedAt: new Date(),
    },
    update: {
      totalBytes: null,
      usedBytes: 0n,
      availableBytes: null,
      lastSyncedAt: new Date(),
    },
  });
}

/**
 * Google Photos no longer supports library browsing via the Library API.
 * Selection happens through the Photos Picker API instead.
 */
export async function browseGooglePhotosFolder(
  accountId: string,
  userId: string,
  parentId: string,
  _searchQuery?: string,
): Promise<ProviderBrowseResult> {
  await prisma.connectedAccount.findFirstOrThrow({
    where: {
      id: accountId,
      userId,
      provider: "google_photos",
      status: "connected",
    },
  });

  return {
    folders: [],
    files: [],
    breadcrumbs: [
      { id: "root", name: "Google Photos" },
      ...(parentId !== "root"
        ? [{ id: parentId, name: "Selected media" }]
        : []),
    ],
  };
}

export async function getGooglePhotosFileMetadata(
  _account: ConnectedAccount,
  _mediaItemId: string,
): Promise<{ id: string; mimeType?: string; filename?: string }> {
  throw new Error(
    "Google Photos media metadata is only available for items selected through the Photos Picker.",
  );
}

export async function downloadGooglePhotosFileStream(
  _account: ConnectedAccount,
  _mediaItemId: string,
): Promise<import("node:stream").Readable> {
  throw new Error(
    "Google Photos downloads require the Photos Picker. Use Import from Google Photos.",
  );
}

export async function uploadGooglePhotosFileFromStream(_params: {
  account: ConnectedAccount;
  body: import("node:stream").Readable;
  fileName: string;
  mimeType: string;
  albumId?: string | null;
  description?: string | null;
}): Promise<{ id: string; mimeType?: string; filename?: string }> {
  throw new Error(
    "Uploading to Google Photos is not supported with the Photos Picker scope. Choose another destination cloud.",
  );
}

export async function deleteGooglePhotosFile(
  _account: ConnectedAccount,
  _mediaItemId: string,
) {
  throw new Error(
    "Google Photos API does not support deleting media items from the library.",
  );
}
