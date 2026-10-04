import "server-only";

import { AppHttpError } from "@/server/http/app-error";

export const SUPPORTED_PROVIDERS = [
  "google_drive",
  "google_photos",
  "google_shared_drive",
  "onedrive",
  "dropbox",
  "pcloud",
  "icloud_drive",
  "icloud_photos",
] as const;

export type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

export function isSupportedProvider(value: string): value is SupportedProvider {
  return (SUPPORTED_PROVIDERS as readonly string[]).includes(value);
}

export type ProviderAuthKind = "oauth" | "credentials";

export type ProviderCatalogEntry = {
  id: SupportedProvider;
  label: string;
  authKind: ProviderAuthKind;
  /** Live folder/file listing against the provider. */
  supportsBrowse: boolean;
  supportsUpload: boolean;
  supportsDownload: boolean;
  supportsDelete: boolean;
  supportsRename: boolean;
  supportsMove: boolean;
  supportsSearch: boolean;
};

export const PROVIDER_CATALOG: readonly ProviderCatalogEntry[] = [
  {
    id: "google_drive",
    label: "Google Drive",
    authKind: "oauth",
    supportsBrowse: true,
    supportsUpload: true,
    supportsDownload: true,
    supportsDelete: true,
    supportsRename: true,
    supportsMove: true,
    supportsSearch: true,
  },
  {
    id: "google_photos",
    label: "Google Photos",
    authKind: "oauth",
    supportsBrowse: true,
    supportsUpload: true,
    supportsDownload: true,
    supportsDelete: false,
    supportsRename: false,
    supportsMove: false,
    supportsSearch: true,
  },
  {
    id: "google_shared_drive",
    label: "Google Shared Drive",
    authKind: "oauth",
    supportsBrowse: true,
    supportsUpload: true,
    supportsDownload: true,
    supportsDelete: true,
    supportsRename: true,
    supportsMove: true,
    supportsSearch: true,
  },
  {
    id: "onedrive",
    label: "OneDrive",
    authKind: "oauth",
    supportsBrowse: true,
    supportsUpload: true,
    supportsDownload: true,
    supportsDelete: true,
    supportsRename: true,
    supportsMove: true,
    supportsSearch: true,
  },
  {
    id: "dropbox",
    label: "Dropbox",
    authKind: "oauth",
    supportsBrowse: true,
    supportsUpload: true,
    supportsDownload: true,
    supportsDelete: true,
    supportsRename: true,
    supportsMove: true,
    supportsSearch: true,
  },
  {
    id: "pcloud",
    label: "pCloud",
    authKind: "oauth",
    supportsBrowse: true,
    supportsUpload: true,
    supportsDownload: true,
    supportsDelete: true,
    supportsRename: true,
    supportsMove: true,
    supportsSearch: true,
  },
  /**
   * iCloud Drive / Photos: Apple ID + 2FA web session.
   */
  {
    id: "icloud_drive",
    label: "iCloud Drive",
    authKind: "credentials",
    supportsBrowse: true,
    supportsUpload: true,
    supportsDownload: true,
    supportsDelete: true,
    supportsRename: false,
    supportsMove: true,
    supportsSearch: true,
  },
  {
    id: "icloud_photos",
    label: "iCloud Photos",
    authKind: "credentials",
    supportsBrowse: true,
    supportsUpload: true,
    supportsDownload: true,
    supportsDelete: true,
    supportsRename: false,
    supportsMove: true,
    supportsSearch: true,
  },
] as const;

export type ProviderCapability =
  | "supportsBrowse"
  | "supportsUpload"
  | "supportsDownload"
  | "supportsDelete"
  | "supportsRename"
  | "supportsMove"
  | "supportsSearch";

export function getProviderCatalogEntry(
  provider: string,
): ProviderCatalogEntry | undefined {
  return PROVIDER_CATALOG.find((p) => p.id === provider);
}

export function providerLabel(provider: string): string {
  return getProviderCatalogEntry(provider)?.label ?? provider;
}

export function providerSupports(
  provider: string,
  capability: ProviderCapability,
): boolean {
  const entry = getProviderCatalogEntry(provider);
  if (!entry) return false;
  return entry[capability];
}

export function providerSupportsMove(provider: string): boolean {
  return providerSupports(provider, "supportsMove");
}

const CAPABILITY_OPERATION_LABEL: Record<ProviderCapability, string> = {
  supportsBrowse: "Browse",
  supportsUpload: "Upload",
  supportsDownload: "Download",
  supportsDelete: "Delete",
  supportsRename: "Rename",
  supportsMove: "Move",
  supportsSearch: "Search",
};

/** Throw a stable public NOT_SUPPORTED error when a capability is missing. */
export function assertProviderCapability(
  provider: string,
  capability: ProviderCapability,
): void {
  if (providerSupports(provider, capability)) return;
  const label = providerLabel(provider);
  const operation = CAPABILITY_OPERATION_LABEL[capability];
  throw new AppHttpError(
    "NOT_SUPPORTED",
    `${operation} is not supported for ${label}.`,
    400,
  );
}

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
  hasThumbnail?: boolean;
};

export type ProviderBrowseResult = {
  folders: ProviderBrowseFolder[];
  files: ProviderBrowseFile[];
  breadcrumbs: Array<{ id: string; name: string }>;
};

export type ProviderCopyResult = {
  destProviderFileId: string;
  name: string;
  mimeType: string;
  sizeBytes: bigint;
};
