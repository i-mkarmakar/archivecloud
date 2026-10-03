import "server-only";

import type { ConnectedAccount } from "@/generated/prisma/client";
import { prisma } from "@/server/config/prisma";
import type {
  ProviderBrowseResult,
  SupportedProvider,
} from "@/server/modules/providers/types";
import { assertProviderCapability } from "@/server/modules/providers/types";
import { encryptText } from "@/server/utils/crypto";

type ICloudProvider = Extract<
  SupportedProvider,
  "icloud_drive" | "icloud_photos"
>;

type ICloudCreds = {
  appleId: string;
  appSpecificPassword: string;
};

export const ICLOUD_CAPABILITY_NOTE =
  "iCloud (Beta) supports account connection only. Browse shows an empty preview until Apple CloudKit is configured. Upload, download, delete, rename, and move are not available.";

function providerLabel(provider: ICloudProvider): string {
  return provider === "icloud_photos" ? "iCloud Photos" : "iCloud Drive";
}

function emptyBrowseResult(provider: ICloudProvider): ProviderBrowseResult {
  return {
    folders: [],
    files: [],
    breadcrumbs: [
      {
        id: "root",
        name: `${providerLabel(provider)} · connection only (no file listing yet)`,
      },
    ],
  };
}

export async function connectICloudAccount(
  userId: string,
  params: {
    appleId: string;
    appSpecificPassword: string;
    provider: ICloudProvider;
    displayName?: string | null;
  },
) {
  const appleId = params.appleId.trim();
  const appSpecificPassword = params.appSpecificPassword.trim();
  const { provider } = params;
  const displayName = params.displayName?.trim() || appleId;

  const creds: ICloudCreds = { appleId, appSpecificPassword };

  return prisma.connectedAccount.upsert({
    where: {
      userId_provider_providerAccountId: {
        userId,
        provider,
        providerAccountId: appleId,
      },
    },
    create: {
      userId,
      provider,
      providerAccountId: appleId,
      email: appleId,
      displayName,
      accessTokenEncrypted: encryptText(JSON.stringify(creds)),
      scopes: [],
      status: "connected",
      lastError: ICLOUD_CAPABILITY_NOTE,
    },
    update: {
      email: appleId,
      displayName,
      accessTokenEncrypted: encryptText(JSON.stringify(creds)),
      status: "connected",
      lastError: ICLOUD_CAPABILITY_NOTE,
    },
  });
}

/** Quota sync placeholder — Apple does not expose quota on this integration path. */
export async function syncICloudQuota(accountId: string) {
  await prisma.connectedAccount.findUniqueOrThrow({ where: { id: accountId } });

  return prisma.storageAccount.upsert({
    where: { connectedAccountId: accountId },
    create: {
      connectedAccountId: accountId,
      totalBytes: null,
      usedBytes: BigInt(0),
      availableBytes: null,
      lastSyncedAt: new Date(),
    },
    update: {
      totalBytes: null,
      usedBytes: BigInt(0),
      availableBytes: null,
      lastSyncedAt: new Date(),
    },
  });
}

export async function browseICloudPhotosFolder(
  accountId: string,
  userId: string,
  _parentId: string,
  _searchQuery?: string,
): Promise<ProviderBrowseResult> {
  await prisma.connectedAccount.findFirstOrThrow({
    where: {
      id: accountId,
      userId,
      provider: "icloud_photos",
      status: "connected",
    },
  });

  return emptyBrowseResult("icloud_photos");
}

async function browseICloudDriveFolder(
  accountId: string,
  userId: string,
  _parentId: string,
  _searchQuery?: string,
): Promise<ProviderBrowseResult> {
  await prisma.connectedAccount.findFirstOrThrow({
    where: {
      id: accountId,
      userId,
      provider: "icloud_drive",
      status: "connected",
    },
  });

  return emptyBrowseResult("icloud_drive");
}

export async function browseICloudFolder(
  provider: ICloudProvider,
  accountId: string,
  userId: string,
  parentId: string,
  searchQuery?: string,
): Promise<ProviderBrowseResult> {
  if (provider === "icloud_photos") {
    return browseICloudPhotosFolder(accountId, userId, parentId, searchQuery);
  }
  return browseICloudDriveFolder(accountId, userId, parentId, searchQuery);
}

export async function getICloudFileMetadata(
  account: ConnectedAccount,
  _fileId: string,
): Promise<never> {
  assertProviderCapability(account.provider, "supportsDownload");
  throw new Error("unreachable");
}

export async function downloadICloudFileStream(
  account: ConnectedAccount,
  _fileId: string,
): Promise<never> {
  assertProviderCapability(account.provider, "supportsDownload");
  throw new Error("unreachable");
}

export async function uploadICloudFileFromStream(params: {
  account: ConnectedAccount;
  parentId: string;
  fileName: string;
  mimeType: string;
  body: unknown;
  sizeBytes?: bigint;
}): Promise<never> {
  assertProviderCapability(params.account.provider, "supportsUpload");
  throw new Error("unreachable");
}

export async function deleteICloudFile(
  account: ConnectedAccount,
  _fileId: string,
): Promise<never> {
  assertProviderCapability(account.provider, "supportsDelete");
  throw new Error("unreachable");
}
