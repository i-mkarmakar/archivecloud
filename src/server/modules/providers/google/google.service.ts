import "server-only";

import { google } from "googleapis";
import type {
  ConnectedAccount,
  ProviderConfig,
} from "@/generated/prisma/client";
import { env } from "@/server/config/env";
import { prisma } from "@/server/config/prisma";
import {
  classifyFileKind,
  classifyFileName,
} from "@/server/modules/files/classify-file-kind";
import { decryptText, encryptText } from "@/server/utils/crypto";

const googleDriveFolderMimeType = "application/vnd.google-apps.folder";
const appFolderName = "archivecloud";
const breakdownStaleMs = 60 * 60 * 1000;

export const googleDriveOAuthScopes = [
  "https://www.googleapis.com/auth/drive",
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

export async function ensureGlobalGoogleProviderConfig(): Promise<ProviderConfig | null> {
  const existing = await prisma.providerConfig.findFirst({
    where: { userId: null, provider: "google_drive", status: "active" },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;

  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = env.GOOGLE_REDIRECT_URI;

  const hasClientId = isConfiguredEnvValue(clientId, [
    "your-google-client-id",
    "your-client-id",
  ]);
  const hasClientSecret = isConfiguredEnvValue(clientSecret, [
    "your-google-client-secret",
    "your-client-secret",
  ]);

  if (!hasClientId || !hasClientSecret) return null;
  if (!clientId || !clientSecret) return null;

  await prisma.providerConfig.updateMany({
    where: { userId: null, provider: "google_drive", status: "active" },
    data: { status: "disabled" },
  });

  return prisma.providerConfig.create({
    data: {
      userId: null,
      provider: "google_drive",
      clientIdEncrypted: encryptText(clientId),
      clientSecretEncrypted: encryptText(clientSecret),
      redirectUri,
      scopes: googleDriveOAuthScopes,
      status: "active",
    },
  });
}

export function createOAuthClient(config: ProviderConfig) {
  return new google.auth.OAuth2(
    decryptText(config.clientIdEncrypted),
    decryptText(config.clientSecretEncrypted),
    config.redirectUri,
  );
}

export async function getAuthedGoogleClient(account: ConnectedAccount) {
  if (
    !account.accessTokenEncrypted ||
    !account.refreshTokenEncrypted ||
    !account.tokenExpiresAt
  )
    throw new Error("Google account tokens are missing.");
  if (!account.providerConfigId)
    throw new Error("Google provider config is missing.");
  const config = await prisma.providerConfig.findUniqueOrThrow({
    where: { id: account.providerConfigId },
  });
  const client = createOAuthClient(config);
  client.setCredentials({
    access_token: decryptText(account.accessTokenEncrypted),
    refresh_token: decryptText(account.refreshTokenEncrypted),
    expiry_date: account.tokenExpiresAt.getTime(),
  });

  if (account.tokenExpiresAt.getTime() < Date.now() + 60_000) {
    const result = await client.refreshAccessToken();
    const credentials = result.credentials;
    if (credentials.access_token) {
      await prisma.connectedAccount.update({
        where: { id: account.id },
        data: {
          accessTokenEncrypted: encryptText(credentials.access_token),
          tokenExpiresAt: new Date(
            credentials.expiry_date ?? Date.now() + 3600_000,
          ),
        },
      });
      client.setCredentials(credentials);
    }
  }

  return client;
}

function driveFileSizeBytes(file: {
  size?: string | null;
  quotaBytesUsed?: string | null;
}) {
  const quotaBytes = file.quotaBytesUsed ? BigInt(file.quotaBytesUsed) : 0n;
  const contentBytes = file.size ? BigInt(file.size) : 0n;
  return quotaBytes > contentBytes ? quotaBytes : contentBytes;
}

export async function syncGoogleQuota(accountId: string) {
  const account = await prisma.connectedAccount.findUniqueOrThrow({
    where: { id: accountId },
  });
  const auth = await getAuthedGoogleClient(account);
  const drive = google.drive({ version: "v3", auth });
  const about = await drive.about.get({ fields: "storageQuota,user" });
  const quota = about.data.storageQuota;
  const total = quota?.limit ? BigInt(quota.limit) : null;
  const used = quota?.usage ? BigInt(quota.usage) : 0n;
  const storageAccount = await prisma.storageAccount.upsert({
    where: { connectedAccountId: accountId },
    create: {
      connectedAccountId: accountId,
      totalBytes: total,
      usedBytes: used,
      availableBytes: total === null ? null : total - used,
      trashBytes: quota?.usageInDriveTrash
        ? BigInt(quota.usageInDriveTrash)
        : null,
      lastSyncedAt: new Date(),
    },
    update: {
      totalBytes: total,
      usedBytes: used,
      availableBytes: total === null ? null : total - used,
      trashBytes: quota?.usageInDriveTrash
        ? BigInt(quota.usageInDriveTrash)
        : null,
      lastSyncedAt: new Date(),
    },
  });

  const breakdownIsStale =
    !storageAccount.breakdownSyncedAt ||
    Date.now() - storageAccount.breakdownSyncedAt.getTime() > breakdownStaleMs;
  if (breakdownIsStale) {
    await syncGoogleDriveBreakdown(accountId).catch(() => undefined);
  }

  return storageAccount;
}

export async function syncGoogleDriveBreakdown(accountId: string) {
  const account = await prisma.connectedAccount.findUniqueOrThrow({
    where: { id: accountId },
  });
  const auth = await getAuthedGoogleClient(account);
  const drive = google.drive({ version: "v3", auth });

  let photoBytes = 0n;
  let videoBytes = 0n;
  let documentBytes = 0n;

  try {
    const driveV2 = google.drive({ version: "v2", auth });
    const aboutV2 = await driveV2.about.get({
      fields: "quotaBytesByService",
    });
    for (const service of aboutV2.data.quotaBytesByService ?? []) {
      if (service.serviceName === "PHOTOS" && service.bytesUsed) {
        photoBytes += BigInt(service.bytesUsed);
      }
    }
  } catch {}

  let pageToken: string | undefined;
  const fileQuery = `trashed = false and mimeType != '${googleDriveFolderMimeType}'`;

  do {
    const response = await drive.files.list({
      q: fileQuery,
      spaces: "drive",
      fields: "nextPageToken,files(name,mimeType,size,quotaBytesUsed)",
      pageSize: 1000,
      pageToken,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });

    for (const file of response.data.files ?? []) {
      const bytes = driveFileSizeBytes(file);
      if (bytes <= 0n) continue;
      const kind = file.mimeType
        ? classifyFileKind(file.mimeType)
        : file.name
          ? classifyFileName(file.name)
          : "document";
      if (kind === "photo") photoBytes += bytes;
      else if (kind === "video") videoBytes += bytes;
      else documentBytes += bytes;
    }

    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return prisma.storageAccount.upsert({
    where: { connectedAccountId: accountId },
    create: {
      connectedAccountId: accountId,
      photoBytes,
      videoBytes,
      documentBytes,
      breakdownSyncedAt: new Date(),
    },
    update: {
      photoBytes,
      videoBytes,
      documentBytes,
      breakdownSyncedAt: new Date(),
    },
  });
}

function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export async function ensureGoogleAppFolder(account: ConnectedAccount) {
  const auth = await getAuthedGoogleClient(account);
  const drive = google.drive({ version: "v3", auth });
  const queryName = escapeDriveQueryValue(appFolderName);
  const existing = await drive.files.list({
    q: `name = '${queryName}' and mimeType = '${googleDriveFolderMimeType}' and 'root' in parents and trashed = false`,
    spaces: "drive",
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
          parents: ["root"],
        },
        fields: "id",
      })
    ).data.id;

  if (!folderId) throw new Error("Failed to create Google Drive app folder.");
  return folderId;
}

export type DriveBrowseFolder = {
  id: string;
  name: string;
  modifiedTime: string;
};

export type DriveBrowseFile = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: string;
  modifiedTime: string;
  dbFileId?: string | null;
  hasThumbnail?: boolean;
};

export type DriveBrowseResult = {
  folders: DriveBrowseFolder[];
  files: DriveBrowseFile[];
  breadcrumbs: Array<{ id: string; name: string }>;
};

async function buildGoogleDriveBreadcrumbs(
  drive: ReturnType<typeof google.drive>,
  folderId: string,
) {
  const breadcrumbs: Array<{ id: string; name: string }> = [
    { id: "root", name: "My Drive" },
  ];
  if (folderId === "root") return breadcrumbs;

  const chain: Array<{ id: string; name: string }> = [];
  let currentId: string | undefined = folderId;
  const visited = new Set<string>();

  while (currentId && currentId !== "root" && !visited.has(currentId)) {
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
    if (!parent || parent === "root") break;
    currentId = parent;
  }

  return [...breadcrumbs, ...chain];
}

export async function browseGoogleDriveFolder(
  accountId: string,
  userId: string,
  parentId: string,
  searchQuery?: string,
  options?: { limit?: number },
): Promise<DriveBrowseResult> {
  const account = await prisma.connectedAccount.findFirstOrThrow({
    where: {
      id: accountId,
      userId,
      provider: "google_drive",
      status: "connected",
    },
  });
  const auth = await getAuthedGoogleClient(account);
  const drive = google.drive({ version: "v3", auth });
  const googleParentId = parentId === "root" ? "root" : parentId;
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

  const folders: DriveBrowseFolder[] = [];
  const files: DriveBrowseFile[] = [];
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
        spaces: "drive",
        fields:
          "nextPageToken,files(id,name,mimeType,size,modifiedTime,quotaBytesUsed,thumbnailLink,hasThumbnail)",
        pageSize,
        pageToken,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
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

  const breadcrumbs = await buildGoogleDriveBreadcrumbs(drive, googleParentId);
  return { folders, files, breadcrumbs };
}

export type GoogleAppFolderSyncResult = {
  accountId: string;
  created: number;
  updated: number;
  deleted: number;
};

type DriveFileMetadata = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: bigint;
  parentId: string;
};

export async function syncGoogleAppFolderFiles(
  accountId: string,
  userId: string,
): Promise<GoogleAppFolderSyncResult> {
  const account = await prisma.connectedAccount.findFirstOrThrow({
    where: {
      id: accountId,
      userId,
      provider: "google_drive",
      status: "connected",
    },
  });
  const auth = await getAuthedGoogleClient(account);
  const drive = google.drive({ version: "v3", auth });
  const appFolderId = await ensureGoogleAppFolder(account);

  const userFolders = await prisma.folder.findMany({
    where: { userId, connectedAccountId: account.id, deletedAt: null },
    select: { id: true, providerFolderId: true },
  });
  const parentIds = [
    appFolderId,
    ...userFolders
      .map((f) => f.providerFolderId)
      .filter((id): id is string => !!id),
  ];

  const driveFiles: DriveFileMetadata[] = [];
  let pageToken: string | undefined;

  const parentsQuery = parentIds.map((id) => `'${id}' in parents`).join(" or ");
  const q = `(${parentsQuery}) and mimeType != '${googleDriveFolderMimeType}' and trashed = false`;

  do {
    const response = await drive.files.list({
      q,
      spaces: "drive",
      fields:
        "nextPageToken,files(id,name,mimeType,size,quotaBytesUsed,parents)",
      pageSize: 1000,
      pageToken,
    });
    for (const file of response.data.files ?? []) {
      if (!file.id || !file.name || !file.mimeType) continue;
      const parentId = file.parents?.[0] ?? appFolderId;
      driveFiles.push({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        sizeBytes: driveFileSizeBytes(file),
        parentId,
      });
    }
    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  const existingFiles = await prisma.file.findMany({
    where: { userId, connectedAccountId: account.id, provider: "google_drive" },
  });
  const existingByProviderId = new Map(
    existingFiles.map((file) => [file.providerFileId, file]),
  );
  const driveFileIds = new Set(driveFiles.map((file) => file.id));
  let created = 0;
  let updated = 0;
  let deleted = 0;

  const folderIdMap = new Map(
    userFolders.map((f) => [f.providerFolderId, f.id]),
  );

  for (const driveFile of driveFiles) {
    const dbFolderId =
      driveFile.parentId === appFolderId
        ? null
        : (folderIdMap.get(driveFile.parentId) ?? null);
    const existing = existingByProviderId.get(driveFile.id);
    if (!existing) {
      await prisma.file.create({
        data: {
          userId,
          connectedAccountId: account.id,
          provider: "google_drive",
          providerFileId: driveFile.id,
          name: driveFile.name,
          mimeType: driveFile.mimeType,
          sizeBytes: driveFile.sizeBytes,
          status: "active",
          folderId: dbFolderId,
        },
      });
      created += 1;
      continue;
    }

    const needsUpdate =
      existing.name !== driveFile.name ||
      existing.mimeType !== driveFile.mimeType ||
      existing.sizeBytes !== driveFile.sizeBytes ||
      existing.status !== "active" ||
      existing.deletedAt !== null ||
      existing.folderId !== dbFolderId;
    if (needsUpdate) {
      await prisma.file.update({
        where: { id: existing.id },
        data: {
          name: driveFile.name,
          mimeType: driveFile.mimeType,
          sizeBytes: driveFile.sizeBytes,
          status: "active",
          deletedAt: null,
          folderId: dbFolderId,
        },
      });
      updated += 1;
    }
  }

  const missingActiveIds = existingFiles
    .filter(
      (file) =>
        file.status === "active" && !driveFileIds.has(file.providerFileId),
    )
    .map((file) => file.id);
  if (missingActiveIds.length > 0) {
    const result = await prisma.file.updateMany({
      where: { id: { in: missingActiveIds }, userId },
      data: { status: "deleted", deletedAt: new Date() },
    });
    deleted = result.count;
  }

  await syncGoogleQuota(account.id).catch(() => undefined);
  return { accountId: account.id, created, updated, deleted };
}

export async function fetchGoogleOAuthUserInfo(
  client: ReturnType<typeof createOAuthClient>,
) {
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  return oauth2.userinfo.get();
}

export async function createGoogleDriveFolder(
  account: ConnectedAccount,
  params: { name: string; parentId: string },
): Promise<string | null> {
  const auth = await getAuthedGoogleClient(account);
  const drive = google.drive({ version: "v3", auth });
  const driveFolder = await drive.files.create({
    requestBody: {
      name: params.name,
      mimeType: googleDriveFolderMimeType,
      parents: [params.parentId],
    },
    fields: "id",
  });
  return driveFolder.data.id ?? null;
}

export async function getGoogleDriveFileBasicMeta(
  account: ConnectedAccount,
  providerFileId: string,
): Promise<{ id: string; name: string; mimeType: string } | null> {
  const auth = await getAuthedGoogleClient(account);
  const drive = google.drive({ version: "v3", auth });
  const metadata = await drive.files.get({
    fileId: providerFileId,
    fields: "id,name,mimeType",
    supportsAllDrives: true,
  });
  if (!metadata.data.id || !metadata.data.name) return null;
  return {
    id: metadata.data.id,
    name: metadata.data.name,
    mimeType: metadata.data.mimeType ?? "application/octet-stream",
  };
}

export async function getGoogleDriveWebLinks(
  account: ConnectedAccount,
  providerFileId: string,
) {
  const auth = await getAuthedGoogleClient(account);
  const drive = google.drive({ version: "v3", auth });
  const metadata = await drive.files.get({
    fileId: providerFileId,
    fields: "webViewLink,webContentLink",
  });
  return {
    webViewLink: metadata.data.webViewLink ?? null,
    webContentLink: metadata.data.webContentLink ?? null,
  };
}

export async function makeGoogleDriveFilePublicReader(
  account: ConnectedAccount,
  providerFileId: string,
) {
  const auth = await getAuthedGoogleClient(account);
  const drive = google.drive({ version: "v3", auth });
  await drive.permissions.create({
    fileId: providerFileId,
    requestBody: { role: "reader", type: "anyone" },
  });
  return getGoogleDriveWebLinks(account, providerFileId);
}
