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
  return PROVIDER_LABELS[provider] ?? provider;
}

export function isSupportedProviderId(id: string): boolean {
  return (SUPPORTED_PROVIDER_IDS as readonly string[]).includes(id);
}
