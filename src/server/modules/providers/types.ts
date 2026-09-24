import "server-only";

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

  supportsMove: boolean;
};

export const PROVIDER_CATALOG: readonly ProviderCatalogEntry[] = [
  {
    id: "google_drive",
    label: "Google Drive",
    authKind: "oauth",
    supportsMove: true,
  },
  {
    id: "google_photos",
    label: "Google Photos",
    authKind: "oauth",
    supportsMove: false,
  },
  {
    id: "google_shared_drive",
    label: "Google Shared Drive",
    authKind: "oauth",
    supportsMove: true,
  },
  {
    id: "onedrive",
    label: "OneDrive",
    authKind: "oauth",
    supportsMove: true,
  },
  {
    id: "dropbox",
    label: "Dropbox",
    authKind: "oauth",
    supportsMove: true,
  },
  {
    id: "pcloud",
    label: "pCloud",
    authKind: "oauth",
    supportsMove: true,
  },
  {
    id: "icloud_drive",
    label: "iCloud Drive",
    authKind: "credentials",
    supportsMove: true,
  },
  {
    id: "icloud_photos",
    label: "iCloud Photos",
    authKind: "credentials",
    supportsMove: true,
  },
] as const;

export function providerLabel(provider: string): string {
  const entry = PROVIDER_CATALOG.find((p) => p.id === provider);
  return entry?.label ?? provider;
}

export function providerSupportsMove(provider: string): boolean {
  const entry = PROVIDER_CATALOG.find((p) => p.id === provider);
  return entry?.supportsMove ?? true;
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
