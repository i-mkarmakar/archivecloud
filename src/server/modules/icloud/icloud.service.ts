

import type { Readable } from "node:stream";
import type { ConnectedAccount } from "@/generated/prisma/client";
import { prisma } from "@/server/config/prisma";
import type {
  ProviderBrowseResult,
  SupportedProvider,
} from "@/server/modules/providers/types";
import { decryptText, encryptText } from "@/server/utils/crypto";

type ICloudProvider = Extract<
  SupportedProvider,
  "icloud_drive" | "icloud_photos"
>;

type ICloudCreds = {
  appleId: string;
  appSpecificPassword: string;
};

const ICLOUD_NOT_AVAILABLE_MSG =
  "iCloud file APIs require Apple CloudKit setup. " +
  "Browsing will be enabled once a CloudKit container is configured " +
  "with ICLOUD_CLOUDKIT_KEY_ID and ICLOUD_CLOUDKIT_PRIVATE_KEY in the " +
  "server environment. Apple does not expose a public iCloud Drive REST API.";

function getICloudCreds(account: ConnectedAccount): ICloudCreds {
  if (!account.accessTokenEncrypted) {
    throw new Error("iCloud credentials missing on account.");
  }
  return JSON.parse(decryptText(account.accessTokenEncrypted)) as ICloudCreds;
}

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
        name: `${providerLabel(provider)} · preview (CloudKit required)`,
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
  },
) {
  const { appleId, appSpecificPassword, provider } = params;

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
      displayName: appleId,
      accessTokenEncrypted: encryptText(JSON.stringify(creds)),
      scopes: [],
      status: "connected",
      lastError:
        "Preview only: browse and transfers require Apple CloudKit configuration.",
    },
    update: {
      email: appleId,
      displayName: appleId,
      accessTokenEncrypted: encryptText(JSON.stringify(creds)),
      status: "connected",
      lastError:
        "Preview only: browse and transfers require Apple CloudKit configuration.",
    },
  });
}

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

export async function ensureICloudAppFolder(
  _account: ConnectedAccount,
): Promise<string> {
  return "root";
}

export async function browseICloudDriveFolder(
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
  _account: ConnectedAccount,
  _fileId: string,
): Promise<never> {
  throw new Error(ICLOUD_NOT_AVAILABLE_MSG);
}

export async function downloadICloudFileStream(
  _account: ConnectedAccount,
  _fileId: string,
): Promise<Readable> {
  throw new Error(ICLOUD_NOT_AVAILABLE_MSG);
}

export async function uploadICloudFileFromStream(_params: {
  account: ConnectedAccount;
  parentId: string;
  fileName: string;
  mimeType: string;
  body: Readable;
  sizeBytes?: bigint;
}): Promise<never> {
  throw new Error(ICLOUD_NOT_AVAILABLE_MSG);
}

export async function deleteICloudFile(
  _account: ConnectedAccount,
  _fileId: string,
): Promise<never> {
  throw new Error(ICLOUD_NOT_AVAILABLE_MSG);
}

export { getICloudCreds };
