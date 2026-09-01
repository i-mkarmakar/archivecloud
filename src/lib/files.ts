import { formatBytes, formatDate } from "@/lib/api";
import type { FileItem } from "@/data/drive-data";

export type ApiFile = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: string;
  createdAt: string;
  updatedAt?: string;
  folderId?: string | null;
  isStarred?: boolean;
  starredAt?: string | null;
  isArchived?: boolean;
  archivedAt?: string | null;
  lastAccessedAt?: string | null;
  connectedAccount?: { email: string; provider: string };
  folder?: { id: string; name: string } | null;
};

function providerLabel(_provider: string | undefined) {
  return "Google Drive";
}

export function mimeToKind(
  mimeType: string,
  fileName?: string,
): FileItem["kind"] {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.includes("pdf")) return "pdf";
  if (fileName) {
    if (/\.(heic|heif|jpe?g|png|gif|webp|bmp|svg|tiff?)$/i.test(fileName)) {
      return "image";
    }
    if (/\.(mp4|mov|avi|mkv|webm|m4v|3gp)$/i.test(fileName)) {
      return "video";
    }
    if (/\.pdf$/i.test(fileName)) return "pdf";
  }
  return "doc";
}

export function mapApiFileToItem(file: ApiFile): FileItem {
  const folderLabel = file.folder?.name ?? "Home";
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    createdAt: file.createdAt,
    accountEmail: file.connectedAccount?.email,
    accountProvider: providerLabel(file.connectedAccount?.provider),
    date: formatDate(file.createdAt),
    size: formatBytes(file.sizeBytes),
    access:
      file.connectedAccount?.email ??
      providerLabel(file.connectedAccount?.provider),
    kind: mimeToKind(file.mimeType),
    shared: 1,
    folderId: file.folderId,
    folderName: file.folder?.name,
    location: folderLabel,
    starredDate: file.starredAt ? formatDate(file.starredAt) : undefined,
    archivedDate: file.archivedAt ? formatDate(file.archivedAt) : undefined,
    openedDate: file.lastAccessedAt
      ? formatDate(file.lastAccessedAt)
      : file.updatedAt
        ? formatDate(file.updatedAt)
        : undefined,
    isStarred: file.isStarred,
    isArchived: file.isArchived,
    lastAccessedAt: file.lastAccessedAt ?? null,
    updatedAt: file.updatedAt,
  };
}

export type FileListView = "default" | "starred" | "archived";

export function buildFilesQuery(view: FileListView, limit?: number) {
  const params = new URLSearchParams();
  if (view === "starred") params.set("view", "starred");
  if (view === "archived") params.set("view", "archived");
  if (limit) params.set("limit", String(limit));
  const qs = params.toString();
  return qs ? `/files?${qs}` : "/files";
}
