export const PROVIDER_LABELS: Record<string, string> = {
  google_drive: "Google Drive",
  google_photos: "Google Photos",
  google_shared_drive: "Google Shared Drive",
  onedrive: "OneDrive",
  dropbox: "Dropbox",
  pcloud: "pCloud",
  icloud_drive: "iCloud Drive",
  icloud_photos: "iCloud Photos",
};

export const SUPPORTED_PROVIDER_IDS = [
  "google_drive",
  "google_photos",
  "google_shared_drive",
  "onedrive",
  "dropbox",
  "pcloud",
  "icloud_drive",
  "icloud_photos",
] as const;

export type SupportedProviderId = (typeof SUPPORTED_PROVIDER_IDS)[number];

export function providerLabel(provider: string | undefined): string {
  if (!provider) return "Unknown";
  const label = PROVIDER_LABELS[provider] ?? provider;
  if (provider === "icloud_drive" || provider === "icloud_photos") {
    return `${label} (Beta)`;
  }
  return label;
}

/** OAuth connect-url path for reconnecting a connected account. */
export function providerConnectUrlPath(provider: string): string | null {
  switch (provider) {
    case "google_drive":
      return "/connected-accounts/google/connect-url";
    case "google_photos":
      return "/connected-accounts/google-photos/connect-url";
    case "google_shared_drive":
      return "/connected-accounts/google-shared-drive/connect-url";
    case "dropbox":
      return "/connected-accounts/dropbox/connect-url";
    case "onedrive":
      return "/connected-accounts/onedrive/connect-url";
    case "pcloud":
      return "/connected-accounts/pcloud/connect-url";
    default:
      return null;
  }
}

export function isSupportedProviderId(id: string): boolean {
  return (SUPPORTED_PROVIDER_IDS as readonly string[]).includes(id);
}
