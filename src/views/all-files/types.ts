import type { ApiFile } from "@/lib/files";

export type BackendFile = ApiFile;

export type BackendFolder = {
  id: string;
  name: string;
  color: string;
  parentId?: string | null;
  providerFolderId?: string | null;
  updatedAt: string;
};

export type ConnectedAccount = {
  id: string;
  provider: string;
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  status: string;
};

export type ProviderBrowseFolder = {
  id: string;
  name: string;
  modifiedTime: string;
};

export type ProviderBrowseFile = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: string;
  modifiedTime: string;
  dbFileId?: string | null;
};

export type ProviderBrowseResult = {
  folders: ProviderBrowseFolder[];
  files: ProviderBrowseFile[];
  breadcrumbs?: Array<{ id: string; name: string }>;
};

export type FileSort =
  | "created_desc"
  | "created_asc"
  | "name_asc"
  | "name_desc"
  | "size_desc"
  | "updated_desc";

export const FILE_SORT_OPTIONS: { value: FileSort; label: string }[] = [
  { value: "created_desc", label: "Created (Newest)" },
  { value: "created_asc", label: "Created (Oldest)" },
  { value: "updated_desc", label: "Modified (Newest)" },
  { value: "name_asc", label: "Name (A–Z)" },
  { value: "name_desc", label: "Name (Z–A)" },
  { value: "size_desc", label: "Size (Largest)" },
];
