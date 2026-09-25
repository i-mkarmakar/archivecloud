import type { FileItem, FolderItem } from "@/data/drive-data";
import { formatDate } from "@/lib/api";
import { mapApiFileToItem } from "@/lib/files";
import { providerLabel } from "@/lib/providers";
import type { BackendFile, BackendFolder, ConnectedAccount } from "./types";

export function accountTitle(account: ConnectedAccount) {
  const name = account.displayName?.trim();
  if (name) return name;
  return `My ${providerLabel(account.provider)}`;
}

export function mapFile(file: BackendFile): FileItem {
  return mapApiFileToItem(file);
}

export function mapFolder(folder: BackendFolder): FolderItem {
  return {
    id: folder.id,
    name: folder.name,
    color: folder.color,
    parentId: folder.parentId,
    providerFolderId: folder.providerFolderId,
    updated: `Updated ${formatDate(folder.updatedAt)}`,
  };
}
