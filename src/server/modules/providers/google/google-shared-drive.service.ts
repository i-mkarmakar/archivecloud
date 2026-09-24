import "server-only";

import type { Readable } from "node:stream";
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
  googleDriveOAuthScopes,
} from "@/server/modules/providers/google/google.service";
import type { ProviderBrowseResult } from "@/server/modules/providers/types";
import { encryptText } from "@/server/utils/crypto";

const googleDriveFolderMimeType = "application/vnd.google-apps.folder";
const appFolderName = "archivecloud";

export const googleSharedDriveOAuthScopes = [...googleDriveOAuthScopes];

function resolveGoogleSharedDriveRedirectUri(): string {
  return env.GOOGLE_SHARED_DRIVE_REDIRECT_URI;
}

function isConfiguredEnvValue(
  value: string | undefined,
  placeholders: string[],
) {
  if (!value?.trim()) return false;
  return !placeholders.includes(value.trim());
}

function driveFileSizeBytes(file: {
  size?: string | null;
  quotaBytesUsed?: string | null;
}) {
  const quotaBytes = file.quotaBytesUsed ? BigInt(file.quotaBytesUsed) : 0n;
  const contentBytes = file.size ? BigInt(file.size) : 0n;
  return quotaBytes > contentBytes ? quotaBytes : contentBytes;
}

function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function requireSharedDriveId(account: ConnectedAccount) {
  if (!account.providerAccountId?.trim()) {
    throw new Error("Shared Drive id is missing on connected account.");
  }
  return account.providerAccountId.trim();
}

export async function ensureGlobalGoogleSharedDriveProviderConfig(): Promise<ProviderConfig | null> {
  const existing = await prisma.providerConfig.findFirst({
    where: { userId: null, provider: "google_shared_drive", status: "active" },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;

  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = resolveGoogleSharedDriveRedirectUri();

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

  await prisma.providerConfig.updateMany({
    where: { userId: null, provider: "google_shared_drive", status: "active" },
    data: { status: "disabled" },
  });

  return prisma.providerConfig.create({
    data: {
      userId: null,
      provider: "google_shared_drive",
      clientIdEncrypted: encryptText(clientId!),
      clientSecretEncrypted: encryptText(clientSecret!),
      redirectUri,
      scopes: googleSharedDriveOAuthScopes,
      status: "active",
    },
  });
}

export function buildGoogleSharedDriveAuthUrl(params: {
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

export async function exchangeGoogleSharedDriveCode(params: {
  config: ProviderConfig;
  code: string;
}) {
  const client = createOAuthClient(params.config);
  const tokenResult = await client.getToken(params.code);
  return tokenResult.tokens;
}

export async function listSharedDrives(account: ConnectedAccount) {
  const auth = await getAuthedGoogleClient(account);
  const drive = google.drive({ version: "v3", auth });
  const drives: Array<{
    id?: string | null;
    name?: string | null;
    createdTime?: string | null;
  }> = [];
  let pageToken: string | undefined;
  do {
    const response = await drive.drives.list({
      pageSize: 100,
      pageToken,
      fields: "nextPageToken,drives(id,name,createdTime)",
    });
    drives.push(...(response.data.drives ?? []));
    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);
  return drives.filter((item) => item.id && item.name);
}

export async function listSharedDrivesWithTokens(
  config: ProviderConfig,
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

export async function connectSharedDriveFromGoogleAccount(params: {
  userId: string;
  providerConfigId: string;
  sharedDriveId: string;
  sharedDriveName?: string | null;
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  scopes: string[];
}) {
  const sharedDriveId = params.sharedDriveId.trim();
  if (!sharedDriveId) {
    throw new Error("Shared Drive id is required.");
  }

  return prisma.connectedAccount.upsert({
    where: {
      userId_provider_providerAccountId: {
        userId: params.userId,
        provider: "google_shared_drive",
        providerAccountId: sharedDriveId,
      },
    },
    create: {
      userId: params.userId,
      providerConfigId: params.providerConfigId,
      provider: "google_shared_drive",
      providerAccountId: sharedDriveId,
      email: params.email,
      displayName: params.sharedDriveName?.trim() || params.displayName,
      avatarUrl: params.avatarUrl,
      accessTokenEncrypted: encryptText(params.accessToken),
      refreshTokenEncrypted: encryptText(params.refreshToken),
      tokenExpiresAt: params.tokenExpiresAt,
      scopes: params.scopes,
      status: "connected",
    },
    update: {
      providerConfigId: params.providerConfigId,
      email: params.email,
      displayName: params.sharedDriveName?.trim() || params.displayName,
      avatarUrl: params.avatarUrl,
      accessTokenEncrypted: encryptText(params.accessToken),
      refreshTokenEncrypted: encryptText(params.refreshToken),
      tokenExpiresAt: params.tokenExpiresAt,
      scopes: params.scopes,
      status: "connected",
    },
  });
}

export async function syncGoogleSharedDriveQuota(accountId: string) {
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

async function getSharedDriveName(
  drive: ReturnType<typeof google.drive>,
  driveId: string,
) {
  try {
    const response = await drive.drives.get({
      driveId,
      fields: "name",
    });
    return response.data.name ?? "Shared Drive";
  } catch {
    return "Shared Drive";
  }
}

async function buildGoogleSharedDriveBreadcrumbs(
  drive: ReturnType<typeof google.drive>,
  driveId: string,
  folderId: string,
) {
  const driveName = await getSharedDriveName(drive, driveId);
  const breadcrumbs: Array<{ id: string; name: string }> = [
    { id: "root", name: driveName },
  ];
  if (folderId === "root" || folderId === driveId) return breadcrumbs;

  const chain: Array<{ id: string; name: string }> = [];
  let currentId: string | undefined = folderId;
  const visited = new Set<string>();

  while (
    currentId &&
    currentId !== driveId &&
    currentId !== "root" &&
    !visited.has(currentId)
  ) {
    visited.add(currentId);
    const response = await drive.files.get({
      fileId: currentId,
      fields: "id,name,parents",
      supportsAllDrives: true,
    });
    const fileData: {
      id?: string | null;
      name?: string | null;
      parents?: string[] | null;
    } = response.data;
    if (!fileData.id || !fileData.name) break;
    chain.unshift({ id: fileData.id, name: fileData.name });
    const parent: string | undefined = fileData.parents?.[0];
    if (!parent || parent === driveId) break;
    currentId = parent;
  }

  return [...breadcrumbs, ...chain];
}

export async function browseGoogleSharedDriveFolder(
  accountId: string,
  userId: string,
  parentId: string,
  searchQuery?: string,
  options?: { limit?: number },
): Promise<ProviderBrowseResult> {
  const account = await prisma.connectedAccount.findFirstOrThrow({
    where: {
      id: accountId,
      userId,
      provider: "google_shared_drive",
      status: "connected",
    },
  });
  const driveId = requireSharedDriveId(account);
  const auth = await getAuthedGoogleClient(account);
  const drive = google.drive({ version: "v3", auth });
  const googleParentId = !parentId || parentId === "root" ? driveId : parentId;
  const maxItems = options?.limit;

  const queryParts = [
    `'${googleParentId}' in parents`,
    "trashed = false",
    `mimeType != '${googleDriveFolderMimeType}'`,
  ];
  if (searchQuery?.trim()) {
    queryParts.push(
      `name contains '${escapeDriveQueryValue(searchQuery.trim())}'`,
    );
  }
  const folderQueryParts = [
    `'${googleParentId}' in parents`,
    "trashed = false",
  ];
  if (searchQuery?.trim()) {
    folderQueryParts.push(
      `name contains '${escapeDriveQueryValue(searchQuery.trim())}'`,
    );
  }

  const folders: ProviderBrowseResult["folders"] = [];
  const files: ProviderBrowseResult["files"] = [];
  const providerFileIds: string[] = [];

  async function listWithQuery(q: string, collectFolders: boolean) {
    let pageToken: string | undefined;
    do {
      const pageSize = maxItems
        ? Math.min(
            100,
            Math.max(
              1,
              maxItems - (collectFolders ? folders.length : files.length),
            ),
          )
        : 100;
      if (pageSize <= 0) return;

      const response = await drive.files.list({
        q,
        corpora: "drive",
        driveId,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        fields:
          "nextPageToken,files(id,name,mimeType,size,modifiedTime,quotaBytesUsed,thumbnailLink,hasThumbnail)",
        pageSize,
        pageToken,
        orderBy: "folder,name",
      });

      for (const file of response.data.files ?? []) {
        if (!file.id || !file.name) continue;
        if (file.mimeType === googleDriveFolderMimeType) {
          if (collectFolders) {
            folders.push({
              id: file.id,
              name: file.name,
              modifiedTime: file.modifiedTime ?? new Date().toISOString(),
            });
            if (maxItems && folders.length >= maxItems) return;
          }
          continue;
        }
        if (!collectFolders) continue;
        providerFileIds.push(file.id);
        files.push({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType ?? "application/octet-stream",
          sizeBytes: driveFileSizeBytes(file).toString(),
          modifiedTime: file.modifiedTime ?? new Date().toISOString(),
          hasThumbnail: Boolean(file.hasThumbnail || file.thumbnailLink),
          dbFileId: null,
        });
        if (maxItems && files.length >= maxItems) return;
      }

      pageToken = maxItems
        ? undefined
        : (response.data.nextPageToken ?? undefined);
    } while (pageToken);
  }

  await listWithQuery(
    `${folderQueryParts.join(" and ")} and mimeType = '${googleDriveFolderMimeType}'`,
    true,
  );
  await listWithQuery(queryParts.join(" and "), true);

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

  folders.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  const breadcrumbs = await buildGoogleSharedDriveBreadcrumbs(
    drive,
    driveId,
    googleParentId,
  );
  return { folders, files, breadcrumbs };
}

export async function ensureGoogleSharedDriveAppFolder(
  account: ConnectedAccount,
) {
  const driveId = requireSharedDriveId(account);
  const auth = await getAuthedGoogleClient(account);
  const drive = google.drive({ version: "v3", auth });
  const queryName = escapeDriveQueryValue(appFolderName);
  const existing = await drive.files.list({
    q: `name = '${queryName}' and mimeType = '${googleDriveFolderMimeType}' and '${driveId}' in parents and trashed = false`,
    corpora: "drive",
    driveId,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    fields: "files(id,name)",
    pageSize: 1,
  });
  const folderId =
    existing.data.files?.[0]?.id ??
    (
      await drive.files.create({
        requestBody: {
          name: appFolderName,
          mimeType: googleDriveFolderMimeType,
          parents: [driveId],
        },
        fields: "id",
        supportsAllDrives: true,
      })
    ).data.id;

  if (!folderId) {
    throw new Error("Failed to create Google Shared Drive app folder.");
  }
  return folderId;
}

export async function getGoogleSharedDriveFileMetadata(
  account: ConnectedAccount,
  fileId: string,
) {
  const auth = await getAuthedGoogleClient(account);
  const drive = google.drive({ version: "v3", auth });
  const response = await drive.files.get({
    fileId,
    fields: "id,name,mimeType,size,quotaBytesUsed,modifiedTime,parents,trashed",
    supportsAllDrives: true,
  });
  return response.data;
}

export async function downloadGoogleSharedDriveFileStream(
  account: ConnectedAccount,
  fileId: string,
) {
  const auth = await getAuthedGoogleClient(account);
  const drive = google.drive({ version: "v3", auth });
  const response = await drive.files.get(
    {
      fileId,
      alt: "media",
      supportsAllDrives: true,
    },
    { responseType: "stream" },
  );
  return response.data as Readable;
}

export async function uploadGoogleSharedDriveFileFromStream(params: {
  account: ConnectedAccount;
  parentId?: string | null;
  fileName: string;
  mimeType: string;
  body: Readable;
}) {
  const auth = await getAuthedGoogleClient(params.account);
  const drive = google.drive({ version: "v3", auth });
  const parentId =
    params.parentId?.trim() ||
    (await ensureGoogleSharedDriveAppFolder(params.account));
  const uploaded = await drive.files.create({
    requestBody: {
      name: params.fileName,
      parents: [parentId],
    },
    media: {
      mimeType: params.mimeType,
      body: params.body,
    },
    fields: "id,name,mimeType,size,quotaBytesUsed",
    supportsAllDrives: true,
  });
  if (!uploaded.data.id) {
    throw new Error("Google Shared Drive upload did not return a file id.");
  }
  return uploaded.data;
}

export async function deleteGoogleSharedDriveFile(
  account: ConnectedAccount,
  fileId: string,
) {
  const auth = await getAuthedGoogleClient(account);
  const drive = google.drive({ version: "v3", auth });
  await drive.files.delete({
    fileId,
    supportsAllDrives: true,
  });
}

export async function getGoogleSharedDriveProfileWithTokens(params: {
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
    throw new Error("Google Shared Drive profile missing id or email.");
  }
  return {
    id,
    email,
    name: profile.data.name,
    picture: profile.data.picture,
  };
}
