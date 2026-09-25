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
import type { ProviderBrowseResult } from "@/server/modules/providers/types";
import { decryptText, encryptText } from "@/server/utils/crypto";

const PHOTOS_API = "https://photoslibrary.googleapis.com/v1";
const LIBRARY_FOLDER_ID = "library";

export const googlePhotosOAuthScopes = [
  "https://www.googleapis.com/auth/photoslibrary",
  "https://www.googleapis.com/auth/photoslibrary.sharing",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

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
    if (
      existing.redirectUri !== redirectUri ||
      decryptText(existing.clientIdEncrypted) !== clientId
    ) {
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

async function photosFetch(
  account: ConnectedAccount,
  path: string,
  init?: RequestInit,
) {
  const auth = await getAuthedGoogleClient(account);
  const authHeaders = normalizeHeaders(await auth.getRequestHeaders());
  const response = await fetch(`${PHOTOS_API}${path}`, {
    ...init,
    headers: {
      ...authHeaders,
      ...(init?.headers ?? {}),
    },
  });
  return response;
}

async function photosJson<T>(
  account: ConnectedAccount,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await photosFetch(account, path, init);
  if (!response.ok) {
    throw new Error(
      `Google Photos API ${path} failed: ${await response.text()}`,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
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

type PhotosAlbum = {
  id: string;
  title: string;
  productUrl?: string;
  coverPhotoBaseUrl?: string;
  mediaItemsCount?: string;
  isWriteable?: boolean;
};

type PhotosMediaItem = {
  id: string;
  productUrl?: string;
  baseUrl?: string;
  mimeType?: string;
  filename?: string;
  mediaMetadata?: {
    creationTime?: string;
    width?: string;
    height?: string;
    photo?: Record<string, unknown>;
    video?: Record<string, unknown>;
  };
  description?: string;
};

function photosMediaMimeType(item: PhotosMediaItem) {
  if (item.mimeType) return item.mimeType;
  if (item.mediaMetadata?.video) return "video/mp4";
  if (item.mediaMetadata?.photo) return "image/jpeg";
  return "application/octet-stream";
}

function photosMediaName(item: PhotosMediaItem) {
  if (item.filename?.trim()) return item.filename.trim();
  const created = item.mediaMetadata?.creationTime;
  const suffix = item.mediaMetadata?.video ? "mp4" : "jpg";
  if (created) {
    const stamp = created.replace(/[:.]/g, "-");
    return `photo-${stamp}.${suffix}`;
  }
  return `media-${item.id}.${suffix}`;
}

function photosMediaSizeBytes(item: PhotosMediaItem) {
  const width = Number(item.mediaMetadata?.width ?? 0);
  const height = Number(item.mediaMetadata?.height ?? 0);
  if (width > 0 && height > 0) return String(width * height);
  return "0";
}

async function listPhotosAlbums(account: ConnectedAccount) {
  const albums: PhotosAlbum[] = [];
  let pageToken: string | undefined;
  do {
    const query = new URLSearchParams({ pageSize: "50" });
    if (pageToken) query.set("pageToken", pageToken);
    const response = await photosJson<{
      albums?: PhotosAlbum[];
      nextPageToken?: string;
    }>(account, `/albums?${query.toString()}`);
    albums.push(...(response.albums ?? []));
    pageToken = response.nextPageToken;
  } while (pageToken);
  return albums;
}

async function searchPhotosMediaItems(
  account: ConnectedAccount,
  body: Record<string, unknown>,
) {
  const items: PhotosMediaItem[] = [];
  let pageToken: string | undefined;
  do {
    const response = await photosJson<{
      mediaItems?: PhotosMediaItem[];
      nextPageToken?: string;
    }>(account, "/mediaItems:search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pageSize: 100,
        ...body,
        ...(pageToken ? { pageToken } : {}),
      }),
    });
    items.push(...(response.mediaItems ?? []));
    pageToken = response.nextPageToken;
  } while (pageToken);
  return items;
}

async function getPhotosAlbum(
  account: ConnectedAccount,
  albumId: string,
): Promise<PhotosAlbum | null> {
  try {
    return await photosJson<PhotosAlbum>(
      account,
      `/albums/${encodeURIComponent(albumId)}`,
    );
  } catch {
    return null;
  }
}

async function buildGooglePhotosBreadcrumbs(
  account: ConnectedAccount,
  parentId: string,
) {
  const breadcrumbs: Array<{ id: string; name: string }> = [
    { id: "root", name: "Google Photos" },
  ];
  if (parentId === "root") return breadcrumbs;
  if (parentId === LIBRARY_FOLDER_ID) {
    breadcrumbs.push({ id: LIBRARY_FOLDER_ID, name: "Photo library" });
    return breadcrumbs;
  }
  const album = await getPhotosAlbum(account, parentId);
  breadcrumbs.push({
    id: parentId,
    name: album?.title ?? "Album",
  });
  return breadcrumbs;
}

export async function browseGooglePhotosFolder(
  accountId: string,
  userId: string,
  parentId: string,
  searchQuery?: string,
): Promise<ProviderBrowseResult> {
  const account = await prisma.connectedAccount.findFirstOrThrow({
    where: {
      id: accountId,
      userId,
      provider: "google_photos",
      status: "connected",
    },
  });

  const q = searchQuery?.trim().toLowerCase();
  const folders: ProviderBrowseResult["folders"] = [];
  const files: ProviderBrowseResult["files"] = [];

  if (parentId === "root") {
    folders.push({
      id: LIBRARY_FOLDER_ID,
      name: "Photo library",
      modifiedTime: new Date().toISOString(),
    });
    const albums = await listPhotosAlbums(account);
    for (const album of albums) {
      if (!album.id || !album.title) continue;
      if (q && !album.title.toLowerCase().includes(q)) continue;
      folders.push({
        id: album.id,
        name: album.title,
        modifiedTime: new Date().toISOString(),
      });
    }
    folders.sort((a, b) => {
      if (a.id === LIBRARY_FOLDER_ID) return -1;
      if (b.id === LIBRARY_FOLDER_ID) return 1;
      return a.name.localeCompare(b.name);
    });
  } else if (parentId === LIBRARY_FOLDER_ID) {
    const mediaItems = await searchPhotosMediaItems(account, {
      filters: {
        mediaTypeFilter: { mediaTypes: ["PHOTO", "VIDEO"] },
      },
    });
    for (const item of mediaItems) {
      if (!item.id) continue;
      const name = photosMediaName(item);
      if (q && !name.toLowerCase().includes(q)) continue;
      files.push({
        id: item.id,
        name,
        mimeType: photosMediaMimeType(item),
        sizeBytes: photosMediaSizeBytes(item),
        modifiedTime:
          item.mediaMetadata?.creationTime ?? new Date().toISOString(),
        hasThumbnail: Boolean(item.baseUrl),
        dbFileId: null,
      });
    }
  } else {
    const mediaItems = await searchPhotosMediaItems(account, {
      albumId: parentId,
    });
    for (const item of mediaItems) {
      if (!item.id) continue;
      const name = photosMediaName(item);
      if (q && !name.toLowerCase().includes(q)) continue;
      files.push({
        id: item.id,
        name,
        mimeType: photosMediaMimeType(item),
        sizeBytes: photosMediaSizeBytes(item),
        modifiedTime:
          item.mediaMetadata?.creationTime ?? new Date().toISOString(),
        hasThumbnail: Boolean(item.baseUrl),
        dbFileId: null,
      });
    }
  }

  files.sort((a, b) => a.name.localeCompare(b.name));

  const providerFileIds = files.map((file) => file.id);
  if (providerFileIds.length > 0) {
    const tracked = await prisma.file.findMany({
      where: {
        userId,
        connectedAccountId: accountId,
        providerFileId: { in: providerFileIds },
        status: "active",
        deletedAt: null,
      },
      select: { id: true, providerFileId: true },
    });
    const dbByProviderId = new Map(
      tracked.map((file) => [file.providerFileId, file.id]),
    );
    for (const file of files) {
      file.dbFileId = dbByProviderId.get(file.id) ?? null;
    }
  }

  const breadcrumbs = await buildGooglePhotosBreadcrumbs(account, parentId);
  return { folders, files, breadcrumbs };
}

export async function getGooglePhotosFileMetadata(
  account: ConnectedAccount,
  mediaItemId: string,
) {
  return photosJson<PhotosMediaItem>(
    account,
    `/mediaItems/${encodeURIComponent(mediaItemId)}`,
  );
}

export async function downloadGooglePhotosFileStream(
  account: ConnectedAccount,
  mediaItemId: string,
) {
  const item = await getGooglePhotosFileMetadata(account, mediaItemId);
  if (!item.baseUrl) {
    throw new Error("Google Photos media item is missing a download URL.");
  }
  const auth = await getAuthedGoogleClient(account);
  const headers = normalizeHeaders(await auth.getRequestHeaders());
  const downloadUrl = `${item.baseUrl}=d`;
  const response = await fetch(downloadUrl, { headers });
  if (!response.ok || !response.body) {
    throw new Error(`Google Photos download failed: ${await response.text()}`);
  }
  return Readable.fromWeb(response.body as import("stream/web").ReadableStream);
}

function toBody(chunk: Buffer): BodyInit {
  return new Blob([new Uint8Array(chunk)]);
}

export async function uploadGooglePhotosFileFromStream(params: {
  account: ConnectedAccount;
  body: Readable;
  fileName: string;
  mimeType: string;
  albumId?: string | null;
  description?: string | null;
}) {
  const chunks: Buffer[] = [];
  for await (const piece of params.body) {
    chunks.push(Buffer.isBuffer(piece) ? piece : Buffer.from(piece));
  }
  const buffer = Buffer.concat(chunks);

  const auth = await getAuthedGoogleClient(params.account);
  const headers = normalizeHeaders(await auth.getRequestHeaders());
  const uploadResponse = await fetch(`${PHOTOS_API}/uploads`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": params.mimeType || "application/octet-stream",
      "X-Goog-Upload-Protocol": "raw",
    },
    body: toBody(buffer),
  });
  if (!uploadResponse.ok) {
    throw new Error(
      `Google Photos upload failed: ${await uploadResponse.text()}`,
    );
  }
  const uploadToken = (await uploadResponse.text()).trim();
  if (!uploadToken) {
    throw new Error("Google Photos upload did not return an upload token.");
  }

  const batchBody: Record<string, unknown> = {
    newMediaItems: [
      {
        description: params.description ?? params.fileName,
        simpleMediaItem: {
          fileName: params.fileName,
          uploadToken,
        },
      },
    ],
  };
  if (params.albumId?.trim()) {
    batchBody.albumId = params.albumId.trim();
  }

  const created = await photosJson<{
    newMediaItemResults?: Array<{
      uploadToken?: string;
      status?: { message?: string };
      mediaItem?: PhotosMediaItem;
    }>;
  }>(params.account, "/mediaItems:batchCreate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(batchBody),
  });

  const result = created.newMediaItemResults?.[0];
  const mediaItem = result?.mediaItem;
  if (!mediaItem?.id) {
    const message = result?.status?.message ?? "Unknown error";
    throw new Error(`Google Photos batchCreate failed: ${message}`);
  }
  return mediaItem;
}

export async function deleteGooglePhotosFile(
  _account: ConnectedAccount,
  _mediaItemId: string,
) {
  throw new Error(
    "Google Photos API does not support deleting media items from the library.",
  );
}
