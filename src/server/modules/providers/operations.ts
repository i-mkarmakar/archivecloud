import "server-only";

import type { Readable } from "node:stream";
import { google } from "googleapis";
import type { ConnectedAccount } from "@/generated/prisma/client";
import {
  browseDropboxFolder,
  deleteDropboxFile,
  downloadDropboxFileStream,
  ensureDropboxAppFolder,
  getDropboxAccessToken,
  getDropboxFileMetadata,
  guessDropboxMimeType,
  joinDropboxPath,
  syncDropboxQuota,
  uploadDropboxFileFromStream,
} from "@/server/modules/dropbox/dropbox.service";
import {
  browseICloudFolder,
  deleteICloudFile,
  downloadICloudFileStream,
  syncICloudQuota,
  uploadICloudFileFromStream,
} from "@/server/modules/icloud/icloud.service";
import {
  browseOneDriveFolder,
  deleteOneDriveFile,
  downloadOneDriveFileStream,
  ensureOneDriveAppFolder,
  getOneDriveAccessToken,
  getOneDriveFileMetadata,
  syncOneDriveQuota,
  uploadOneDriveFileFromStream,
} from "@/server/modules/onedrive/onedrive.service";
import {
  browsePCloudFolder,
  deletePCloudFile,
  downloadPCloudFileStream,
  ensurePCloudAppFolder,
  getPCloudAccessToken,
  getPCloudApiBaseForAccount,
  getPCloudFileMetadata,
  syncPCloudQuota,
  uploadPCloudFileFromStream,
} from "@/server/modules/pcloud/pcloud.service";
import {
  googleDownloadExportMimeTypes,
  withExtension,
} from "@/server/modules/providers/google/drive-stream";
import {
  browseGoogleDriveFolder,
  ensureGoogleAppFolder,
  getAuthedGoogleClient,
  syncGoogleQuota,
} from "@/server/modules/providers/google/google.service";
import {
  browseGooglePhotosFolder,
  deleteGooglePhotosFile,
  downloadGooglePhotosFileStream,
  getGooglePhotosFileMetadata,
  syncGooglePhotosQuota,
  uploadGooglePhotosFileFromStream,
} from "@/server/modules/providers/google/google-photos.service";
import {
  browseGoogleSharedDriveFolder,
  deleteGoogleSharedDriveFile,
  downloadGoogleSharedDriveFileStream,
  getGoogleSharedDriveFileMetadata,
  syncGoogleSharedDriveQuota,
  uploadGoogleSharedDriveFileFromStream,
} from "@/server/modules/providers/google/google-shared-drive.service";
import { copyGoogleDriveFile } from "@/server/modules/providers/google/google-transfer";
import type {
  ProviderBrowseResult,
  ProviderCopyResult,
} from "@/server/modules/providers/types";
import { isSupportedProvider } from "@/server/modules/providers/types";

const GOOGLE_APPS_PREFIX = "application/vnd.google-apps.";

export type PulledFile = {
  stream: Readable;
  mimeType: string;
  name: string;
  sizeBytes: bigint;
};

function guessMimeFromName(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".zip")) return "application/zip";
  return "application/octet-stream";
}

export async function syncProviderQuota(account: ConnectedAccount) {
  switch (account.provider) {
    case "google_drive":
      return syncGoogleQuota(account.id);
    case "google_photos":
      return syncGooglePhotosQuota(account.id);
    case "google_shared_drive":
      return syncGoogleSharedDriveQuota(account.id);
    case "dropbox":
      return syncDropboxQuota(account.id);
    case "onedrive":
      return syncOneDriveQuota(account.id);
    case "pcloud":
      return syncPCloudQuota(account.id);
    case "icloud_drive":
    case "icloud_photos":
      return syncICloudQuota(account.id);
    default:
      throw new Error(`Quota sync not supported for ${account.provider}`);
  }
}

export async function browseProviderFolder(
  account: ConnectedAccount,
  userId: string,
  parentId: string,
  searchQuery?: string,
  options?: { limit?: number },
): Promise<ProviderBrowseResult> {
  const id = account.id;
  const limit = options?.limit;
  switch (account.provider) {
    case "google_drive":
      return browseGoogleDriveFolder(id, userId, parentId, searchQuery, {
        limit,
      });
    case "google_photos":
      return browseGooglePhotosFolder(id, userId, parentId, searchQuery);
    case "google_shared_drive":
      return browseGoogleSharedDriveFolder(id, userId, parentId, searchQuery, {
        limit,
      });
    case "dropbox":
      return browseDropboxFolder(id, userId, parentId, searchQuery, { limit });
    case "onedrive":
      return browseOneDriveFolder(id, userId, parentId, searchQuery, { limit });
    case "pcloud":
      return browsePCloudFolder(id, userId, parentId, searchQuery, { limit });
    case "icloud_drive":
    case "icloud_photos":
      return browseICloudFolder(
        account.provider,
        id,
        userId,
        parentId,
        searchQuery,
      );
    default:
      throw new Error(`Browse not supported for ${account.provider}`);
  }
}

async function pullGoogleDrive(
  account: ConnectedAccount,
  providerFileId: string,
  mimeType: string,
  name: string,
): Promise<PulledFile> {
  const auth = await getAuthedGoogleClient(account);
  const drive = google.drive({ version: "v3", auth });
  const meta = await drive.files.get({
    fileId: providerFileId,
    fields: "id,name,mimeType,size,quotaBytesUsed",
    supportsAllDrives: true,
  });
  const sourceMime = meta.data.mimeType ?? mimeType;
  const sourceName = name || meta.data.name || "untitled";
  const sizeBytes = meta.data.size
    ? BigInt(meta.data.size)
    : meta.data.quotaBytesUsed
      ? BigInt(meta.data.quotaBytesUsed)
      : 0n;

  if (sourceMime.startsWith(GOOGLE_APPS_PREFIX)) {
    const exportTarget = googleDownloadExportMimeTypes[sourceMime];
    if (!exportTarget) {
      throw new Error(`Cannot export Google Workspace type "${sourceMime}".`);
    }
    const exported = await drive.files.export(
      { fileId: providerFileId, mimeType: exportTarget.mimeType },
      { responseType: "stream" },
    );
    return {
      stream: exported.data as Readable,
      mimeType: exportTarget.mimeType,
      name: withExtension(sourceName, exportTarget.extension),
      sizeBytes,
    };
  }

  const media = await drive.files.get(
    { fileId: providerFileId, alt: "media", supportsAllDrives: true },
    { responseType: "stream" },
  );
  return {
    stream: media.data as Readable,
    mimeType: sourceMime,
    name: sourceName,
    sizeBytes,
  };
}

export async function pullProviderFile(
  account: ConnectedAccount,
  providerFileId: string,
  fileName?: string,
): Promise<PulledFile> {
  switch (account.provider) {
    case "google_drive":
      return pullGoogleDrive(
        account,
        providerFileId,
        "application/octet-stream",
        fileName ?? "untitled",
      );
    case "google_shared_drive": {
      const meta = await getGoogleSharedDriveFileMetadata(
        account,
        providerFileId,
      );
      const stream = await downloadGoogleSharedDriveFileStream(
        account,
        providerFileId,
      );
      return {
        stream,
        mimeType: meta.mimeType ?? "application/octet-stream",
        name: fileName?.trim() || meta.name || "untitled",
        sizeBytes: meta.size
          ? BigInt(meta.size)
          : meta.quotaBytesUsed
            ? BigInt(meta.quotaBytesUsed)
            : 0n,
      };
    }
    case "google_photos": {
      const meta = await getGooglePhotosFileMetadata(account, providerFileId);
      const stream = await downloadGooglePhotosFileStream(
        account,
        providerFileId,
      );
      return {
        stream,
        mimeType: meta.mimeType ?? "application/octet-stream",
        name: fileName?.trim() || meta.filename || "untitled",
        sizeBytes: 0n,
      };
    }
    case "dropbox": {
      const meta = await getDropboxFileMetadata(account, providerFileId);
      const name = fileName?.trim() || meta.name || "untitled";
      return {
        stream: await downloadDropboxFileStream(account, providerFileId),
        mimeType: guessDropboxMimeType(name),
        name,
        sizeBytes: BigInt(meta.size ?? 0),
      };
    }
    case "onedrive": {
      const meta = await getOneDriveFileMetadata(account, providerFileId);
      return {
        stream: await downloadOneDriveFileStream(account, providerFileId),
        mimeType: meta.file?.mimeType ?? "application/octet-stream",
        name: fileName?.trim() || meta.name || "untitled",
        sizeBytes: BigInt(meta.size ?? 0),
      };
    }
    case "pcloud": {
      const { metadata } = await getPCloudFileMetadata(account, providerFileId);
      const name = fileName?.trim() || metadata.name || "untitled";
      return {
        stream: await downloadPCloudFileStream(account, providerFileId),
        mimeType: metadata.contenttype ?? guessMimeFromName(name),
        name,
        sizeBytes: BigInt(metadata.size ?? 0),
      };
    }
    case "icloud_drive":
    case "icloud_photos": {
      await downloadICloudFileStream(account, providerFileId);
      throw new Error("iCloud download is not available yet.");
    }
    default:
      throw new Error(`Download not supported for ${account.provider}`);
  }
}

export async function pushPulledFileToProvider(
  account: ConnectedAccount,
  pulled: PulledFile,
  destParentId?: string | null,
): Promise<ProviderCopyResult> {
  return pushProviderFile(account, pulled, destParentId);
}

async function pushProviderFile(
  account: ConnectedAccount,
  pulled: PulledFile,
  destParentId?: string | null,
): Promise<ProviderCopyResult> {
  switch (account.provider) {
    case "google_drive": {
      const auth = await getAuthedGoogleClient(account);
      const drive = google.drive({ version: "v3", auth });
      const parent =
        destParentId?.trim() || (await ensureGoogleAppFolder(account));
      const uploaded = await drive.files.create({
        requestBody: { name: pulled.name, parents: [parent] },
        media: { mimeType: pulled.mimeType, body: pulled.stream },
        fields: "id,name,mimeType,size",
        supportsAllDrives: true,
      });
      if (!uploaded.data.id) {
        throw new Error("Google Drive upload did not return a file id.");
      }
      return {
        destProviderFileId: uploaded.data.id,
        name: uploaded.data.name ?? pulled.name,
        mimeType: uploaded.data.mimeType ?? pulled.mimeType,
        sizeBytes: uploaded.data.size ? BigInt(uploaded.data.size) : 0n,
      };
    }
    case "google_shared_drive": {
      const uploaded = await uploadGoogleSharedDriveFileFromStream({
        account,
        parentId: destParentId,
        fileName: pulled.name,
        mimeType: pulled.mimeType,
        body: pulled.stream,
      });
      return {
        destProviderFileId: uploaded.id!,
        name: uploaded.name ?? pulled.name,
        mimeType: uploaded.mimeType ?? pulled.mimeType,
        sizeBytes: uploaded.size ? BigInt(uploaded.size) : pulled.sizeBytes,
      };
    }
    case "google_photos": {
      const albumId =
        destParentId?.trim() &&
        destParentId !== "root" &&
        destParentId !== "library"
          ? destParentId
          : null;
      const uploaded = await uploadGooglePhotosFileFromStream({
        account,
        body: pulled.stream,
        fileName: pulled.name,
        mimeType: pulled.mimeType,
        albumId,
      });
      return {
        destProviderFileId: uploaded.id,
        name: uploaded.filename ?? pulled.name,
        mimeType: uploaded.mimeType ?? pulled.mimeType,
        sizeBytes: pulled.sizeBytes,
      };
    }
    case "dropbox": {
      const parent =
        destParentId?.trim() && destParentId !== "root"
          ? destParentId
          : await ensureDropboxAppFolder(account);
      const destPath = joinDropboxPath(parent, pulled.name);
      const uploaded = await uploadDropboxFileFromStream({
        account,
        destPath,
        body: pulled.stream,
        sizeBytes: pulled.sizeBytes > 0n ? pulled.sizeBytes : undefined,
      });
      return {
        destProviderFileId: uploaded.id,
        name: uploaded.name,
        mimeType: pulled.mimeType,
        sizeBytes: BigInt(uploaded.size ?? Number(pulled.sizeBytes)),
      };
    }
    case "onedrive": {
      const parent =
        destParentId?.trim() && destParentId !== "root"
          ? destParentId
          : await ensureOneDriveAppFolder(account);
      const uploaded = await uploadOneDriveFileFromStream({
        account,
        parentId: parent,
        fileName: pulled.name,
        mimeType: pulled.mimeType,
        body: pulled.stream,
        sizeBytes: pulled.sizeBytes > 0n ? pulled.sizeBytes : undefined,
      });
      return {
        destProviderFileId: uploaded.id,
        name: uploaded.name,
        mimeType: uploaded.mimeType ?? pulled.mimeType,
        sizeBytes: BigInt(uploaded.size ?? Number(pulled.sizeBytes)),
      };
    }
    case "pcloud": {
      const folderId =
        destParentId?.trim() && destParentId !== "root"
          ? destParentId
          : await ensurePCloudAppFolder(account);
      const uploaded = await uploadPCloudFileFromStream({
        account,
        folderId,
        fileName: pulled.name,
        body: pulled.stream,
        sizeBytes: pulled.sizeBytes > 0n ? pulled.sizeBytes : undefined,
      });
      return {
        destProviderFileId: String(uploaded.fileid),
        name: uploaded.name,
        mimeType: uploaded.contenttype ?? pulled.mimeType,
        sizeBytes: BigInt(uploaded.size ?? Number(pulled.sizeBytes)),
      };
    }
    case "icloud_drive":
    case "icloud_photos": {
      await uploadICloudFileFromStream({
        account,
        parentId: destParentId?.trim() || "root",
        fileName: pulled.name,
        mimeType: pulled.mimeType,
        body: pulled.stream,
        sizeBytes: pulled.sizeBytes,
      });
      throw new Error("iCloud upload is not available yet.");
    }
    default:
      throw new Error(`Upload not supported for ${account.provider}`);
  }
}

export async function deleteProviderFile(params: {
  account: ConnectedAccount;
  providerFileId: string;
}) {
  const { account, providerFileId } = params;
  switch (account.provider) {
    case "google_drive": {
      const auth = await getAuthedGoogleClient(account);
      const drive = google.drive({ version: "v3", auth });
      await drive.files.delete({
        fileId: providerFileId,
        supportsAllDrives: true,
      });
      return;
    }
    case "google_shared_drive":
      await deleteGoogleSharedDriveFile(account, providerFileId);
      return;
    case "google_photos":
      await deleteGooglePhotosFile(account, providerFileId);
      return;
    case "dropbox":
      await deleteDropboxFile(account, providerFileId);
      return;
    case "onedrive":
      await deleteOneDriveFile(account, providerFileId);
      return;
    case "pcloud":
      await deletePCloudFile(account, providerFileId);
      return;
    case "icloud_drive":
    case "icloud_photos":
      await deleteICloudFile(account, providerFileId);
      return;
    default:
      throw new Error(`Delete not supported for ${account.provider}`);
  }
}

export async function renameProviderFile(params: {
  account: ConnectedAccount;
  providerFileId: string;
  newName: string;
}): Promise<{ id: string; name: string }> {
  const name = params.newName.trim();
  if (!name) throw new Error("New name is required.");
  const { account, providerFileId } = params;

  switch (account.provider) {
    case "google_drive":
    case "google_shared_drive": {
      const auth = await getAuthedGoogleClient(account);
      const drive = google.drive({ version: "v3", auth });
      const updated = await drive.files.update({
        fileId: providerFileId,
        requestBody: { name },
        fields: "id,name",
        supportsAllDrives: true,
      });
      if (!updated.data.id) throw new Error("Rename failed.");
      return { id: updated.data.id, name: updated.data.name ?? name };
    }
    case "dropbox": {
      const accessToken = await getDropboxAccessToken(account);
      const meta = await getDropboxFileMetadata(account, providerFileId);
      const fromPath = meta.path_display || providerFileId;
      if (!fromPath) throw new Error("Dropbox path missing for rename.");
      const parent = fromPath.includes("/")
        ? fromPath.slice(0, fromPath.lastIndexOf("/")) || ""
        : "";
      const toPathRaw = `${parent}/${name}`.replace(/\/+/g, "/");
      const toPath = toPathRaw.startsWith("/") ? toPathRaw : `/${toPathRaw}`;
      const response = await fetch(
        "https://api.dropboxapi.com/2/files/move_v2",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from_path: fromPath,
            to_path: toPath,
            autorename: false,
          }),
        },
      );
      if (!response.ok) {
        throw new Error(`Dropbox rename failed: ${await response.text()}`);
      }
      const data = (await response.json()) as {
        metadata?: { id?: string; name?: string; path_display?: string };
      };
      return {
        id: data.metadata?.id || data.metadata?.path_display || providerFileId,
        name: data.metadata?.name ?? name,
      };
    }
    case "onedrive": {
      const accessToken = await getOneDriveAccessToken(account);
      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(providerFileId)}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name }),
        },
      );
      if (!response.ok) {
        throw new Error(`OneDrive rename failed: ${await response.text()}`);
      }
      const data = (await response.json()) as { id: string; name: string };
      return { id: data.id, name: data.name };
    }
    case "pcloud": {
      const accessToken = await getPCloudAccessToken(account);
      const apiBase = getPCloudApiBaseForAccount(account);
      const url = new URL(`${apiBase}/renamefile`);
      url.searchParams.set("access_token", accessToken);
      url.searchParams.set("fileid", providerFileId);
      url.searchParams.set("toname", name);
      const response = await fetch(url);
      const data = (await response.json()) as {
        result: number;
        error?: string;
        metadata?: { fileid: number; name: string };
      };
      if (!response.ok || data.result !== 0) {
        const folderUrl = new URL(`${apiBase}/renamefolder`);
        folderUrl.searchParams.set("access_token", accessToken);
        folderUrl.searchParams.set("folderid", providerFileId);
        folderUrl.searchParams.set("toname", name);
        const folderResponse = await fetch(folderUrl);
        const folderData = (await folderResponse.json()) as {
          result: number;
          error?: string;
          metadata?: { folderid: number; name: string };
        };
        if (!folderResponse.ok || folderData.result !== 0) {
          throw new Error(
            data.error ?? folderData.error ?? "pCloud rename failed",
          );
        }
        return {
          id: String(folderData.metadata?.folderid ?? providerFileId),
          name: folderData.metadata?.name ?? name,
        };
      }
      return {
        id: String(data.metadata?.fileid ?? providerFileId),
        name: data.metadata?.name ?? name,
      };
    }
    case "google_photos":
      throw new Error("Google Photos does not support renaming media items.");
    default:
      throw new Error(`Rename not supported for ${account.provider}`);
  }
}

export async function moveProviderItem(params: {
  account: ConnectedAccount;
  providerItemId: string;
  destParentId: string;
}): Promise<{ id: string; name: string }> {
  const { account, providerItemId } = params;
  const destParentId =
    !params.destParentId || params.destParentId === "root"
      ? "root"
      : params.destParentId;

  switch (account.provider) {
    case "google_drive":
    case "google_shared_drive": {
      const auth = await getAuthedGoogleClient(account);
      const drive = google.drive({ version: "v3", auth });
      const fileInfo = await drive.files.get({
        fileId: providerItemId,
        fields: "id,name,parents",
        supportsAllDrives: true,
      });
      const previousParents = fileInfo.data.parents?.join(",") ?? "";
      let addParents = destParentId;
      if (destParentId === "root") {
        const rootMeta = await drive.files.get({
          fileId: "root",
          fields: "id",
          supportsAllDrives: true,
        });
        addParents = rootMeta.data.id ?? "root";
      }
      const updated = await drive.files.update({
        fileId: providerItemId,
        addParents,
        removeParents: previousParents || undefined,
        fields: "id,name,parents",
        supportsAllDrives: true,
      });
      if (!updated.data.id) throw new Error("Move failed.");
      return {
        id: updated.data.id,
        name: updated.data.name ?? fileInfo.data.name ?? "untitled",
      };
    }
    case "dropbox": {
      const accessToken = await getDropboxAccessToken(account);
      const meta = await getDropboxFileMetadata(account, providerItemId);
      const fromPath = meta.path_display || providerItemId;
      if (!fromPath) throw new Error("Dropbox path missing for move.");
      const baseName = fromPath.includes("/")
        ? fromPath.slice(fromPath.lastIndexOf("/") + 1)
        : fromPath;
      let toParent = "";
      if (destParentId !== "root") {
        const destMeta = await getDropboxFileMetadata(account, destParentId);
        toParent = destMeta.path_display || destParentId;
      }
      const toPathRaw = `${toParent}/${baseName}`.replace(/\/+/g, "/");
      const toPath = toPathRaw.startsWith("/") ? toPathRaw : `/${toPathRaw}`;
      const response = await fetch(
        "https://api.dropboxapi.com/2/files/move_v2",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from_path: fromPath,
            to_path: toPath,
            autorename: false,
          }),
        },
      );
      if (!response.ok) {
        throw new Error(`Dropbox move failed: ${await response.text()}`);
      }
      const data = (await response.json()) as {
        metadata?: { id?: string; name?: string; path_display?: string };
      };
      return {
        id: data.metadata?.id || data.metadata?.path_display || providerItemId,
        name: data.metadata?.name ?? baseName,
      };
    }
    case "onedrive": {
      const accessToken = await getOneDriveAccessToken(account);
      const parentRef =
        destParentId === "root"
          ? { path: "/drive/root:" }
          : { id: destParentId };
      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(providerItemId)}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ parentReference: parentRef }),
        },
      );
      if (!response.ok) {
        throw new Error(`OneDrive move failed: ${await response.text()}`);
      }
      const data = (await response.json()) as { id: string; name: string };
      return { id: data.id, name: data.name };
    }
    case "pcloud": {
      const accessToken = await getPCloudAccessToken(account);
      const apiBase = getPCloudApiBaseForAccount(account);
      const toFolderId = destParentId === "root" ? "0" : destParentId;
      const fileUrl = new URL(`${apiBase}/renamefile`);
      fileUrl.searchParams.set("access_token", accessToken);
      fileUrl.searchParams.set("fileid", providerItemId);
      fileUrl.searchParams.set("tofolderid", toFolderId);
      const fileResponse = await fetch(fileUrl);
      const fileData = (await fileResponse.json()) as {
        result: number;
        error?: string;
        metadata?: { fileid: number; name: string };
      };
      if (fileResponse.ok && fileData.result === 0) {
        return {
          id: String(fileData.metadata?.fileid ?? providerItemId),
          name: fileData.metadata?.name ?? "untitled",
        };
      }
      const folderUrl = new URL(`${apiBase}/renamefolder`);
      folderUrl.searchParams.set("access_token", accessToken);
      folderUrl.searchParams.set("folderid", providerItemId);
      folderUrl.searchParams.set("tofolderid", toFolderId);
      const folderResponse = await fetch(folderUrl);
      const folderData = (await folderResponse.json()) as {
        result: number;
        error?: string;
        metadata?: { folderid: number; name: string };
      };
      if (!folderResponse.ok || folderData.result !== 0) {
        throw new Error(
          fileData.error ?? folderData.error ?? "pCloud move failed",
        );
      }
      return {
        id: String(folderData.metadata?.folderid ?? providerItemId),
        name: folderData.metadata?.name ?? "untitled",
      };
    }
    case "google_photos":
      throw new Error("Google Photos does not support moving media items.");
    default:
      throw new Error(`Move not supported for ${account.provider}`);
  }
}

export async function getProviderFileMeta(
  account: ConnectedAccount,
  providerFileId: string,
): Promise<{ name: string; mimeType: string; sizeBytes: bigint }> {
  switch (account.provider) {
    case "google_drive":
    case "google_shared_drive": {
      const auth = await getAuthedGoogleClient(account);
      const drive = google.drive({ version: "v3", auth });
      const meta = await drive.files.get({
        fileId: providerFileId,
        fields: "id,name,mimeType,size,quotaBytesUsed",
        supportsAllDrives: true,
      });
      return {
        name: meta.data.name ?? "untitled",
        mimeType: meta.data.mimeType ?? "application/octet-stream",
        sizeBytes: meta.data.size
          ? BigInt(meta.data.size)
          : meta.data.quotaBytesUsed
            ? BigInt(meta.data.quotaBytesUsed)
            : 0n,
      };
    }
    case "google_photos": {
      const meta = await getGooglePhotosFileMetadata(account, providerFileId);
      return {
        name: meta.filename ?? "untitled",
        mimeType: meta.mimeType ?? "application/octet-stream",
        sizeBytes: 0n,
      };
    }
    case "dropbox": {
      const meta = await getDropboxFileMetadata(account, providerFileId);
      const name = meta.name ?? "untitled";
      return {
        name,
        mimeType: guessDropboxMimeType(name),
        sizeBytes: BigInt(meta.size ?? 0),
      };
    }
    case "onedrive": {
      const meta = await getOneDriveFileMetadata(account, providerFileId);
      return {
        name: meta.name ?? "untitled",
        mimeType: meta.file?.mimeType ?? "application/octet-stream",
        sizeBytes: BigInt(meta.size ?? 0),
      };
    }
    case "pcloud": {
      const { metadata } = await getPCloudFileMetadata(account, providerFileId);
      return {
        name: metadata.name ?? "untitled",
        mimeType: metadata.contenttype ?? guessMimeFromName(metadata.name),
        sizeBytes: BigInt(metadata.size ?? 0),
      };
    }
    default:
      throw new Error(`Metadata not supported for ${account.provider}`);
  }
}

export async function ensureProviderChildFolder(
  account: ConnectedAccount,
  parentId: string,
  folderName: string,
): Promise<string> {
  const name = folderName.trim();
  if (!name) throw new Error("Folder name is required.");

  const browse = await browseProviderFolder(
    account,
    account.userId,
    parentId || "root",
  );
  const existing = browse.folders.find(
    (folder) => folder.name.toLowerCase() === name.toLowerCase(),
  );
  if (existing) return existing.id;

  switch (account.provider) {
    case "google_drive":
    case "google_shared_drive": {
      const auth = await getAuthedGoogleClient(account);
      const drive = google.drive({ version: "v3", auth });
      let parent = parentId?.trim() || "root";
      if (account.provider === "google_shared_drive") {
        parent =
          parentId?.trim() && parentId !== "root"
            ? parentId
            : account.providerAccountId;
      } else if (!parent || parent === "root") {
        parent = "root";
      }
      const created = await drive.files.create({
        requestBody: {
          name,
          mimeType: "application/vnd.google-apps.folder",
          parents: [parent],
        },
        fields: "id",
        supportsAllDrives: true,
      });
      if (!created.data.id) {
        throw new Error("Failed to create Google Drive folder.");
      }
      return created.data.id;
    }
    case "dropbox": {
      const parentPath =
        !parentId || parentId === "root"
          ? await ensureDropboxAppFolder(account)
          : parentId;
      const destPath = joinDropboxPath(parentPath, name);
      const accessToken = await getDropboxAccessToken(account);
      const response = await fetch(
        "https://api.dropboxapi.com/2/files/create_folder_v2",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ path: destPath, autorename: false }),
        },
      );
      if (!response.ok) {
        const text = await response.text();
        if (text.includes("path/conflict")) {
          const again = await browseProviderFolder(
            account,
            account.userId,
            parentId || "root",
          );
          const found = again.folders.find(
            (folder) => folder.name.toLowerCase() === name.toLowerCase(),
          );
          if (found) return found.id;
        }
        throw new Error(`Dropbox create folder failed: ${text}`);
      }
      const data = (await response.json()) as {
        metadata?: { path_display?: string; id?: string };
      };
      return data.metadata?.path_display || data.metadata?.id || destPath;
    }
    case "onedrive": {
      const accessToken = await getOneDriveAccessToken(account);
      const parent =
        !parentId || parentId === "root"
          ? await ensureOneDriveAppFolder(account)
          : parentId;
      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(parent)}/children`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            folder: {},
            "@microsoft.graph.conflictBehavior": "fail",
          }),
        },
      );
      if (response.status === 409) {
        const again = await browseProviderFolder(
          account,
          account.userId,
          parent,
        );
        const found = again.folders.find(
          (folder) => folder.name.toLowerCase() === name.toLowerCase(),
        );
        if (found) return found.id;
      }
      if (!response.ok) {
        throw new Error(
          `OneDrive create folder failed: ${await response.text()}`,
        );
      }
      const created = (await response.json()) as { id: string };
      return created.id;
    }
    case "pcloud": {
      const folderId =
        !parentId || parentId === "root"
          ? await ensurePCloudAppFolder(account)
          : parentId;
      const accessToken = await getPCloudAccessToken(account);
      const apiBase = getPCloudApiBaseForAccount(account);
      const url = new URL(`${apiBase}/createfolderifnotexists`);
      url.searchParams.set("access_token", accessToken);
      url.searchParams.set("folderid", String(folderId));
      url.searchParams.set("name", name);
      const response = await fetch(url);
      const data = (await response.json()) as {
        result: number;
        error?: string;
        metadata?: { folderid: number };
      };
      if (!response.ok || data.result !== 0 || !data.metadata?.folderid) {
        throw new Error(data.error ?? "pCloud create folder failed");
      }
      return String(data.metadata.folderid);
    }
    case "google_photos": {
      throw new Error(
        "Google Photos does not support nested folder creation for sync.",
      );
    }
    default:
      throw new Error(
        `Creating folders is not supported for ${account.provider}`,
      );
  }
}

export async function copyBetweenProviders(params: {
  sourceAccount: ConnectedAccount;
  destAccount: ConnectedAccount;
  sourceProviderFileId: string;
  destParentId?: string | null;
  fileName?: string;
}): Promise<ProviderCopyResult> {
  const { sourceAccount, destAccount } = params;

  if (!isSupportedProvider(sourceAccount.provider)) {
    throw new Error(`Unsupported source provider: ${sourceAccount.provider}`);
  }
  if (!isSupportedProvider(destAccount.provider)) {
    throw new Error(
      `Unsupported destination provider: ${destAccount.provider}`,
    );
  }

  if (
    sourceAccount.provider === "google_drive" &&
    destAccount.provider === "google_drive"
  ) {
    return copyGoogleDriveFile(params);
  }

  const pulled = await pullProviderFile(
    sourceAccount,
    params.sourceProviderFileId,
    params.fileName,
  );
  return pushProviderFile(destAccount, pulled, params.destParentId);
}
