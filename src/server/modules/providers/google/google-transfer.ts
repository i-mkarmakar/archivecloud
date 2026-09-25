import "server-only";

import { google } from "googleapis";
import type { ConnectedAccount } from "@/generated/prisma/client";
import {
  googleDownloadExportMimeTypes,
  withExtension,
} from "@/server/modules/providers/google/drive-stream";
import {
  ensureGoogleAppFolder,
  getAuthedGoogleClient,
} from "@/server/modules/providers/google/google.service";
import type { ProviderCopyResult } from "@/server/modules/providers/types";

const GOOGLE_APPS_PREFIX = "application/vnd.google-apps.";

function driveFileSizeBytes(file: {
  size?: string | null;
  quotaBytesUsed?: string | null;
}) {
  if (file.size) return BigInt(file.size);
  if (file.quotaBytesUsed) return BigInt(file.quotaBytesUsed);
  return 0n;
}

export async function copyGoogleDriveFile(params: {
  sourceAccount: ConnectedAccount;
  destAccount: ConnectedAccount;
  sourceProviderFileId: string;
  destParentId?: string | null;
  fileName?: string;
}): Promise<ProviderCopyResult> {
  const sourceAuth = await getAuthedGoogleClient(params.sourceAccount);
  const destAuth = await getAuthedGoogleClient(params.destAccount);
  const sourceDrive = google.drive({ version: "v3", auth: sourceAuth });
  const destDrive = google.drive({ version: "v3", auth: destAuth });

  const meta = await sourceDrive.files.get({
    fileId: params.sourceProviderFileId,
    fields: "id,name,mimeType,size,quotaBytesUsed",
    supportsAllDrives: true,
  });

  const name = params.fileName?.trim() || meta.data.name || "untitled";
  const mimeType = meta.data.mimeType ?? "application/octet-stream";
  const sizeBytes = driveFileSizeBytes(meta.data);
  const destParentId =
    params.destParentId?.trim() ||
    (await ensureGoogleAppFolder(params.destAccount));

  const sameAccount = params.sourceAccount.id === params.destAccount.id;
  const isGoogleNative = mimeType.startsWith(GOOGLE_APPS_PREFIX);

  if (sameAccount && !isGoogleNative) {
    const copied = await sourceDrive.files.copy({
      fileId: params.sourceProviderFileId,
      requestBody: {
        name,
        parents: [destParentId],
      },
      fields: "id,name,mimeType,size",
      supportsAllDrives: true,
    });
    if (!copied.data.id) {
      throw new Error("Google Drive copy did not return a file id.");
    }
    return {
      destProviderFileId: copied.data.id,
      name: copied.data.name ?? name,
      mimeType: copied.data.mimeType ?? mimeType,
      sizeBytes: driveFileSizeBytes(copied.data) || sizeBytes,
    };
  }

  if (sameAccount && isGoogleNative) {
    const copied = await sourceDrive.files.copy({
      fileId: params.sourceProviderFileId,
      requestBody: {
        name,
        parents: [destParentId],
      },
      fields: "id,name,mimeType,size,quotaBytesUsed",
      supportsAllDrives: true,
    });
    if (!copied.data.id) {
      throw new Error("Google Drive copy did not return a file id.");
    }
    return {
      destProviderFileId: copied.data.id,
      name: copied.data.name ?? name,
      mimeType: copied.data.mimeType ?? mimeType,
      sizeBytes: driveFileSizeBytes(copied.data) || sizeBytes,
    };
  }

  if (isGoogleNative) {
    const exportTarget = googleDownloadExportMimeTypes[mimeType];
    if (!exportTarget) {
      throw new Error(
        `Cannot transfer Google Workspace type "${mimeType}" across accounts.`,
      );
    }
    const exported = await sourceDrive.files.export(
      {
        fileId: params.sourceProviderFileId,
        mimeType: exportTarget.mimeType,
      },
      { responseType: "stream" },
    );
    const uploadName = withExtension(name, exportTarget.extension);
    const uploaded = await destDrive.files.create({
      requestBody: { name: uploadName, parents: [destParentId] },
      media: {
        mimeType: exportTarget.mimeType,
        body: exported.data,
      },
      fields: "id,name,mimeType,size",
      supportsAllDrives: true,
    });
    if (!uploaded.data.id) {
      throw new Error("Destination upload did not return a file id.");
    }
    return {
      destProviderFileId: uploaded.data.id,
      name: uploaded.data.name ?? uploadName,
      mimeType: uploaded.data.mimeType ?? exportTarget.mimeType,
      sizeBytes: driveFileSizeBytes(uploaded.data) || sizeBytes,
    };
  }

  const media = await sourceDrive.files.get(
    {
      fileId: params.sourceProviderFileId,
      alt: "media",
      supportsAllDrives: true,
    },
    { responseType: "stream" },
  );
  const uploaded = await destDrive.files.create({
    requestBody: { name, parents: [destParentId] },
    media: { mimeType, body: media.data },
    fields: "id,name,mimeType,size",
    supportsAllDrives: true,
  });
  if (!uploaded.data.id) {
    throw new Error("Destination upload did not return a file id.");
  }
  return {
    destProviderFileId: uploaded.data.id,
    name: uploaded.data.name ?? name,
    mimeType: uploaded.data.mimeType ?? mimeType,
    sizeBytes: driveFileSizeBytes(uploaded.data) || sizeBytes,
  };
}
