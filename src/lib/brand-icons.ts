export type BrandIconTheme = "light" | "dark";

const BRAND_ICON_SRC = {
  google: "/brand/google.svg",
  "google-drive": "/brand/google-drive.svg",
  "google-photos": "/brand/google-photos.svg",
  dropbox: "/brand/dropbox.svg",
  onedrive: "/brand/onedrive.svg",
  pcloud: "/brand/pcloud.svg",
  icloud: "/brand/icloud.svg",
  github: "/brand/github.svg",
} as const;

export type BrandIconName = keyof typeof BRAND_ICON_SRC;

const PROVIDER_BRAND_KEYS: Record<string, BrandIconName> = {
  google_drive: "google-drive",
  google_shared_drive: "google",
  google_photos: "google-photos",
  dropbox: "dropbox",
  onedrive: "onedrive",
  pcloud: "pcloud",
  icloud_drive: "icloud",
  icloud_photos: "icloud",
};

const SEARCH_ALIASES: Record<string, BrandIconName> = {
  google: "google",
  "shared drive": "google",
  "google shared drive": "google",
  "google-shared-drive": "google",
  "google drive": "google-drive",
  "google-drive": "google-drive",
  "google photos": "google-photos",
  "google-photos": "google-photos",
  dropbox: "dropbox",
  onedrive: "onedrive",
  "microsoft onedrive": "onedrive",
  pcloud: "pcloud",
  icloud: "icloud",
  github: "github",
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function resolveBrandIconKey(
  searchOrProvider: string,
): BrandIconName | undefined {
  const key = normalizeKey(searchOrProvider);
  return PROVIDER_BRAND_KEYS[key] ?? SEARCH_ALIASES[key];
}

export function getBrandLogoSrc(
  searchOrProvider: string,
  theme: BrandIconTheme = "light",
): string | undefined {
  const key = resolveBrandIconKey(searchOrProvider);
  if (!key) return undefined;

  void theme;
  return BRAND_ICON_SRC[key];
}
