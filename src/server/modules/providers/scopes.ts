/** Central OAuth / connect scope lists for connected cloud accounts. */

export const GOOGLE_DRIVE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
] as const;

export const GOOGLE_SHARED_DRIVE_OAUTH_SCOPES = [
  ...GOOGLE_DRIVE_OAUTH_SCOPES,
] as const;

/** Picker (select from library) + Library append (copy into Photos / app-created). */
export const GOOGLE_PHOTOS_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/photospicker.mediaitems.readonly",
  "https://www.googleapis.com/auth/photoslibrary.appendonly",
  "https://www.googleapis.com/auth/photoslibrary.readonly.appcreateddata",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
] as const;

export const DROPBOX_OAUTH_SCOPES = [
  "account_info.read",
  "files.metadata.read",
  "files.content.read",
  "files.content.write",
] as const;

export const ONEDRIVE_OAUTH_SCOPES = [
  "offline_access",
  "User.Read",
  "Files.ReadWrite.All",
] as const;

/** pCloud OAuth has no scope strings; regional host is stored separately. */
export const PCLOUD_OAUTH_SCOPES: readonly string[] = [];

/** iCloud uses Apple ID password + 2FA session, not OAuth scopes. */
export const ICLOUD_OAUTH_SCOPES: readonly string[] = [];

/** Legacy re-exports used by provider services / tests. */
export const googleDriveOAuthScopes = [...GOOGLE_DRIVE_OAUTH_SCOPES];
export const googleSharedDriveOAuthScopes = [
  ...GOOGLE_SHARED_DRIVE_OAUTH_SCOPES,
];
export const googlePhotosOAuthScopes = [...GOOGLE_PHOTOS_OAUTH_SCOPES];
export const dropboxOAuthScopes = [...DROPBOX_OAUTH_SCOPES];
export const onedriveOAuthScopes = [...ONEDRIVE_OAUTH_SCOPES];

const PCLOUD_HOST_SCOPE_PREFIX = "pcloud_host:";

export type NeedsReconnectReason = "scopes" | "dropbox_full_access";

export function requiredScopesForProvider(provider: string): readonly string[] {
  switch (provider) {
    case "google_drive":
      return GOOGLE_DRIVE_OAUTH_SCOPES;
    case "google_shared_drive":
      return GOOGLE_SHARED_DRIVE_OAUTH_SCOPES;
    case "google_photos":
      return GOOGLE_PHOTOS_OAUTH_SCOPES;
    case "dropbox":
      return DROPBOX_OAUTH_SCOPES;
    case "onedrive":
      return ONEDRIVE_OAUTH_SCOPES;
    case "pcloud":
      return PCLOUD_OAUTH_SCOPES;
    case "icloud_drive":
    case "icloud_photos":
      return ICLOUD_OAUTH_SCOPES;
    default:
      return [];
  }
}

export function normalizeGrantedScopes(scopes: unknown): string[] {
  if (!Array.isArray(scopes)) return [];
  return scopes.filter(
    (scope): scope is string =>
      typeof scope === "string" &&
      scope.length > 0 &&
      !scope.startsWith(PCLOUD_HOST_SCOPE_PREFIX),
  );
}

export function hasRequiredScopes(provider: string, granted: unknown): boolean {
  const required = requiredScopesForProvider(provider);
  if (required.length === 0) return true;
  const grantedSet = new Set(normalizeGrantedScopes(granted));
  return required.every((scope) => grantedSet.has(scope));
}

export function accountNeedsReconnect(
  account: {
    provider: string;
    scopes: unknown;
    dropboxNeedsFullAccess?: boolean;
  },
  options: { wholeAccountIndexingEnabled: boolean },
): { needsReconnect: boolean; reason: NeedsReconnectReason | null } {
  if (!hasRequiredScopes(account.provider, account.scopes)) {
    return { needsReconnect: true, reason: "scopes" };
  }
  if (
    options.wholeAccountIndexingEnabled &&
    account.provider === "dropbox" &&
    account.dropboxNeedsFullAccess
  ) {
    return { needsReconnect: true, reason: "dropbox_full_access" };
  }
  return { needsReconnect: false, reason: null };
}
