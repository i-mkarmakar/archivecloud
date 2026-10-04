import "server-only";

import { Readable } from "node:stream";
import { google } from "googleapis";
import type {
  ConnectedAccount,
  ProviderConfig,
} from "@/generated/prisma/client";
import { env } from "@/server/config/env";
import { prisma } from "@/server/config/prisma";
import { normalizeHeaders } from "@/server/modules/providers/google/drive-stream";
import {
  createOAuthClient,
  getAuthedGoogleClient,
} from "@/server/modules/providers/google/google.service";
import { googlePhotosOAuthScopes } from "@/server/modules/providers/scopes";
import type { ProviderBrowseResult } from "@/server/modules/providers/types";
import { decryptText, encryptText } from "@/server/utils/crypto";

export { googlePhotosOAuthScopes };

const LIBRARY_API = "https://photoslibrary.googleapis.com/v1";

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

async function photosAuthHeaders(account: ConnectedAccount) {
  const auth = await getAuthedGoogleClient(account);
  return normalizeHeaders(await auth.getRequestHeaders());
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
    prompt: "select_account consent",
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

async function listAppCreatedAlbums(account: ConnectedAccount) {
  const headers = await photosAuthHeaders(account);
  const albums: Array<{ id: string; title: string }> = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(`${LIBRARY_API}/albums`);
    url.searchParams.set("pageSize", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, { headers });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `Google Photos albums.list failed (${response.status}): ${text.slice(0, 200)}`,
      );
    }
    const data = (await response.json()) as {
      albums?: Array<{ id?: string; title?: string }>;
      nextPageToken?: string;
    };
    for (const album of data.albums ?? []) {
      if (album.id) {
        albums.push({ id: album.id, title: album.title?.trim() || "Album" });
      }
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return albums;
}

export async function createGooglePhotosAlbum(
  account: ConnectedAccount,
  title: string,
): Promise<string> {
  const headers = await photosAuthHeaders(account);
  const response = await fetch(`${LIBRARY_API}/albums`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ album: { title } }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Google Photos albums.create failed (${response.status}): ${text.slice(0, 200)}`,
    );
  }
  const data = (await response.json()) as { id?: string };
  if (!data.id) throw new Error("Google Photos album create returned no id.");
  return data.id;
}

/**
 * Lists app DB records (picker copies + uploads) and app-created albums.
 * Full user library browse remains Google-blocked; use the Photos Picker for that.
 */
export async function browseGooglePhotosFolder(
  accountId: string,
  userId: string,
  parentId: string,
  searchQuery?: string,
): Promise<ProviderBrowseResult> {
  await prisma.connectedAccount.findFirstOrThrow({
    where: {
      id: accountId,
      userId,
      provider: "google_photos",
      status: "connected",
    },
  });

  const account = await prisma.connectedAccount.findFirstOrThrow({
    where: { id: accountId },
  });

  const q = searchQuery?.trim().toLowerCase();

  if (parentId !== "root") {
    const albumFiles: ProviderBrowseResult["files"] = [];
    try {
      const headers = await photosAuthHeaders(account);
      const response = await fetch(`${LIBRARY_API}/mediaItems:search`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ albumId: parentId, pageSize: 100 }),
      });
      if (response.ok) {
        const data = (await response.json()) as {
          mediaItems?: Array<{
            id?: string;
            filename?: string;
            mimeType?: string;
            mediaMetadata?: { creationTime?: string };
          }>;
        };
        for (const item of data.mediaItems ?? []) {
          if (!item.id) continue;
          const name = item.filename ?? "untitled";
          if (q && !name.toLowerCase().includes(q)) continue;
          albumFiles.push({
            id: item.id,
            name,
            mimeType: item.mimeType ?? "application/octet-stream",
            sizeBytes: "0",
            modifiedTime: item.mediaMetadata?.creationTime
              ? new Date(item.mediaMetadata.creationTime).toISOString()
              : new Date().toISOString(),
            dbFileId: null,
          });
        }
      }
    } catch {
      // Album listing is best-effort.
    }
    return {
      folders: [],
      files: albumFiles,
      breadcrumbs: [
        { id: "root", name: "Google Photos" },
        { id: parentId, name: "Album" },
      ],
    };
  }

  const files = await prisma.file.findMany({
    where: {
      userId,
      connectedAccountId: accountId,
      provider: "google_photos",
      status: "active",
      ...(q
        ? { name: { contains: searchQuery!.trim(), mode: "insensitive" } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  let folders: Array<{ id: string; name: string; modifiedTime: string }> = [];
  if (!q) {
    try {
      const albums = await listAppCreatedAlbums(account);
      folders = albums.map((album) => ({
        id: album.id,
        name: album.title,
        modifiedTime: new Date().toISOString(),
      }));
    } catch {
      folders = [];
    }
  }

  return {
    folders,
    files: files.map((file) => ({
      id: file.providerFileId,
      name: file.name,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes?.toString() ?? "0",
      modifiedTime: file.createdAt.toISOString(),
      dbFileId: file.id,
    })),
    breadcrumbs: [{ id: "root", name: "Google Photos" }],
  };
}

export async function getGooglePhotosFileMetadata(
  account: ConnectedAccount,
  mediaItemId: string,
): Promise<{ id: string; mimeType?: string; filename?: string }> {
  const headers = await photosAuthHeaders(account);
  const response = await fetch(
    `${LIBRARY_API}/mediaItems/${encodeURIComponent(mediaItemId)}`,
    { headers },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Google Photos mediaItems.get failed (${response.status}): ${text.slice(0, 200)}`,
    );
  }
  const data = (await response.json()) as {
    id?: string;
    mimeType?: string;
    filename?: string;
  };
  if (!data.id) throw new Error("Google Photos media item not found.");
  return {
    id: data.id,
    mimeType: data.mimeType,
    filename: data.filename,
  };
}

export async function downloadGooglePhotosFileStream(
  account: ConnectedAccount,
  mediaItemId: string,
): Promise<Readable> {
  const headers = await photosAuthHeaders(account);
  const metaResponse = await fetch(
    `${LIBRARY_API}/mediaItems/${encodeURIComponent(mediaItemId)}`,
    { headers },
  );
  if (!metaResponse.ok) {
    const text = await metaResponse.text().catch(() => "");
    throw new Error(
      `Google Photos mediaItems.get failed (${metaResponse.status}): ${text.slice(0, 200)}`,
    );
  }
  const data = (await metaResponse.json()) as {
    baseUrl?: string;
    mimeType?: string;
  };
  if (!data.baseUrl) {
    throw new Error("Google Photos media item has no download URL.");
  }
  const isVideo = (data.mimeType ?? "").startsWith("video/");
  const downloadUrl = `${data.baseUrl}=${isVideo ? "dv" : "d"}`;
  const response = await fetch(downloadUrl, { headers });
  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Google Photos download failed (${response.status}): ${text.slice(0, 200)}`,
    );
  }
  return Readable.fromWeb(response.body as import("stream/web").ReadableStream);
}

export async function uploadGooglePhotosFileFromStream(params: {
  account: ConnectedAccount;
  body: Readable;
  fileName: string;
  mimeType: string;
  albumId?: string | null;
  description?: string | null;
}): Promise<{ id: string; mimeType?: string; filename?: string }> {
  const headers = await photosAuthHeaders(params.account);
  const chunks: Buffer[] = [];
  for await (const chunk of params.body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const buffer = Buffer.concat(chunks);

  const uploadResponse = await fetch(`${LIBRARY_API}/uploads`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/octet-stream",
      "X-Goog-Upload-Content-Type":
        params.mimeType || "application/octet-stream",
      "X-Goog-Upload-Protocol": "raw",
    },
    body: buffer,
  });
  if (!uploadResponse.ok) {
    const text = await uploadResponse.text().catch(() => "");
    throw new Error(
      `Google Photos upload failed (${uploadResponse.status}): ${text.slice(0, 200)}`,
    );
  }
  const uploadToken = (await uploadResponse.text()).trim();
  if (!uploadToken) {
    throw new Error("Google Photos upload did not return an upload token.");
  }

  const albumId =
    params.albumId?.trim() &&
    params.albumId !== "root" &&
    params.albumId !== "library"
      ? params.albumId.trim()
      : undefined;

  const createBody: Record<string, unknown> = {
    newMediaItems: [
      {
        simpleMediaItem: {
          fileName: params.fileName,
          uploadToken,
        },
      },
    ],
  };
  if (albumId) createBody.albumId = albumId;

  const createResponse = await fetch(`${LIBRARY_API}/mediaItems:batchCreate`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(createBody),
  });
  if (!createResponse.ok) {
    const text = await createResponse.text().catch(() => "");
    throw new Error(
      `Google Photos batchCreate failed (${createResponse.status}): ${text.slice(0, 200)}`,
    );
  }
  const created = (await createResponse.json()) as {
    newMediaItemResults?: Array<{
      status?: { code?: number; message?: string };
      mediaItem?: { id?: string; mimeType?: string; filename?: string };
    }>;
  };
  const result = created.newMediaItemResults?.[0];
  const mediaItem = result?.mediaItem;
  if (!mediaItem?.id) {
    throw new Error(
      result?.status?.message ||
        "Google Photos batchCreate did not return a media item.",
    );
  }
  return {
    id: mediaItem.id,
    mimeType: mediaItem.mimeType ?? params.mimeType,
    filename: mediaItem.filename ?? params.fileName,
  };
}

export async function deleteGooglePhotosFile(
  _account: ConnectedAccount,
  _mediaItemId: string,
) {
  throw new Error(
    "Google Photos API does not support deleting media items from the library.",
  );
}
