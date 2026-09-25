export const ACCOUNT_FOLDER_PREFIX = "account:";
export const LINKED_FOLDER_PREFIX = "linked:";
export const LINKED_FILE_PREFIX = "linked:";
export const MAX_RENAME_LENGTH = 100;
export const FILES_PAGE_SIZE = 40;
export const LINKED_BROWSE_LIMIT = 40;

export function isAccountFolderId(id: string | undefined | null) {
  return Boolean(id?.startsWith(ACCOUNT_FOLDER_PREFIX));
}

export function isLinkedFolderId(id: string | undefined | null) {
  return Boolean(id?.startsWith(LINKED_FOLDER_PREFIX));
}

export function isLinkedFileId(id: string | undefined | null) {
  return Boolean(id?.startsWith(LINKED_FILE_PREFIX));
}

export function parseLinkedRef(id: string) {
  const rest = id.slice(LINKED_FOLDER_PREFIX.length);
  const splitAt = rest.indexOf(":");
  if (splitAt <= 0) return null;
  return {
    accountId: rest.slice(0, splitAt),
    providerId: rest.slice(splitAt + 1),
  };
}
