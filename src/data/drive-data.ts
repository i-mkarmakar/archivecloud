export type FolderItem = {
  id?: string;
  name: string;
  updated: string;
  color: string;
  parentId?: string | null;
  providerFolderId?: string | null;
};

export type FileItem = {
  id?: string;
  name: string;
  mimeType?: string;
  date: string;
  size: string;
  sizeBytes?: string;
  access: string;
  accountEmail?: string;
  accountProvider?: string;
  accountAvatarUrl?: string | null;
  accountDisplayName?: string | null;
  createdAt?: string;
  kind: "doc" | "image" | "video" | "pdf";
  shared: number;
  owner?: string;
  location?: string;
  archivedDate?: string;
  starredDate?: string;
  openedDate?: string;
  isStarred?: boolean;
  isArchived?: boolean;
  lastAccessedAt?: string | null;
  updatedAt?: string;
  folderId?: string | null;
  folderName?: string | null;
  providerFileId?: string | null;
  connectedAccountId?: string | null;
  thumbnailUrl?: string | null;
};
