import "server-only";

import { prisma } from "@/server/config/prisma";
import type { CatalogIndexItem } from "@/server/modules/indexing/catalog-upsert";
import { DROPBOX_ROOT_PROVIDER_ID } from "@/server/modules/indexing/root";
import type {
  CatalogChangeOp,
  IndexPage,
  ProviderIndexAdapter,
} from "@/server/modules/indexing/types";
import {
  assertDropboxPersonalAccount,
  DropboxTeamAccountError,
} from "@/server/modules/providers/dropbox/dropbox-account";
import {
  type DropboxListEntry,
  fetchDropboxListFolderPage,
  isDropboxAuthError,
  isDropboxRateLimitedError,
  isDropboxResetCursorError,
} from "@/server/modules/providers/dropbox/dropbox-list-folder";

function guessMime(name: string): string {
  const lower = name.toLowerCase();
  if (/\.paper$/.test(lower)) return "application/vnd.dropbox.paper";
  if (/\.(jpe?g)$/.test(lower)) return "image/jpeg";
  if (/\.png$/.test(lower)) return "image/png";
  if (/\.pdf$/.test(lower)) return "application/pdf";
  if (/\.txt$/.test(lower)) return "text/plain";
  return "application/octet-stream";
}

/** Parent path_lower; "" means account root. */
export function dropboxParentPathLower(pathLower: string): string | null {
  const normalized = pathLower.replace(/\/+$/, "").toLowerCase();
  if (!normalized || normalized === "/") return null;
  const idx = normalized.lastIndexOf("/");
  if (idx <= 0) return "";
  return normalized.slice(0, idx);
}

/**
 * Shared-folder mount point: folder metadata carries its own shared_folder_id.
 * Nested files only have parent_shared_folder_id — those stay downloadable.
 */
export function isDropboxSharedFolderMount(entry: DropboxListEntry): boolean {
  if (entry[".tag"] !== "folder") return false;
  return Boolean(entry.sharing_info?.shared_folder_id);
}

export function dropboxBlockedReason(entry: DropboxListEntry): string | null {
  if (isDropboxSharedFolderMount(entry)) return "shared_folder";
  if (/\.paper$/i.test(entry.name)) return "paper";
  if (entry[".tag"] === "file" && entry.is_downloadable === false) {
    return "not_downloadable";
  }
  return null;
}

/**
 * Map list_folder entry → catalog op.
 * DeletedMetadata: exact path remove when we know it's a file; path-prefix when
 * folder or unknown (Dropbox may omit individual children).
 */
export function mapDropboxEntryToOp(
  entry: DropboxListEntry,
  rootId: string,
  pathToId: Map<string, string>,
  knownFolderPaths?: Set<string>,
): CatalogChangeOp {
  const pathLower = entry.path_lower?.toLowerCase();
  if (!pathLower) return { type: "ignore" };

  if (entry[".tag"] === "deleted") {
    const wasFolder =
      knownFolderPaths?.has(pathLower) || pathToId.has(pathLower);
    if (wasFolder) {
      return { type: "remove_path_prefix", pathLower };
    }
    // Exact path for files; also safe if unknown (no children under a file path).
    return { type: "remove_path", pathLower };
  }

  if (!entry.id) return { type: "ignore" };

  const isFolder = entry[".tag"] === "folder";
  const parentPath = dropboxParentPathLower(pathLower);
  let providerParentId: string | null = rootId;
  if (parentPath === null) {
    return { type: "ignore" };
  }
  if (parentPath !== "") {
    providerParentId = pathToId.get(parentPath) ?? `path:${parentPath}`;
  }

  if (isFolder) {
    pathToId.set(pathLower, entry.id);
  }

  const blockedReason = dropboxBlockedReason(entry);
  const isShortcut = blockedReason != null;

  const item: CatalogIndexItem = {
    id: entry.id,
    name: entry.name,
    mimeType: isFolder
      ? "application/vnd.archivecloud.folder"
      : blockedReason === "paper"
        ? "application/vnd.dropbox.paper"
        : guessMime(entry.name),
    sizeBytes:
      isFolder || entry.size == null
        ? null
        : BigInt(Math.max(0, Math.trunc(entry.size))),
    providerParentId,
    providerPathLower: pathLower,
    isFolder,
    isShortcut,
    shortcutTargetId: null,
    blockedReason,
  };
  return { type: "upsert", item };
}

/** Longest paths first so nested deletes land before parents. */
export function orderDropboxPathDeletes(paths: string[]): string[] {
  return [...paths].sort((a, b) => b.length - a.length || a.localeCompare(b));
}

async function ensureDropboxRootProviderId(accountId: string): Promise<string> {
  const account = await prisma.connectedAccount.findUniqueOrThrow({
    where: { id: accountId },
  });
  if (account.indexRootProviderId) return account.indexRootProviderId;
  await prisma.connectedAccount.update({
    where: { id: accountId },
    data: { indexRootProviderId: DROPBOX_ROOT_PROVIDER_ID },
  });
  return DROPBOX_ROOT_PROVIDER_ID;
}

async function loadPathMap(accountId: string): Promise<{
  pathToId: Map<string, string>;
  folderPaths: Set<string>;
}> {
  const folders = await prisma.file.findMany({
    where: {
      connectedAccountId: accountId,
      isFolder: true,
      providerPathLower: { not: null },
      status: "active",
    },
    select: { providerFileId: true, providerPathLower: true },
  });
  const pathToId = new Map<string, string>();
  const folderPaths = new Set<string>();
  for (const folder of folders) {
    if (folder.providerPathLower) {
      pathToId.set(folder.providerPathLower, folder.providerFileId);
      folderPaths.add(folder.providerPathLower);
    }
  }
  return { pathToId, folderPaths };
}

function pageFromEntries(params: {
  entries: DropboxListEntry[];
  cursor: string;
  hasMore: boolean;
  rootId: string;
  pathToId: Map<string, string>;
  folderPaths: Set<string>;
}): IndexPage {
  const items: CatalogIndexItem[] = [];
  const removedPaths: string[] = [];
  const removedPathPrefixes: string[] = [];
  for (const entry of params.entries) {
    const op = mapDropboxEntryToOp(
      entry,
      params.rootId,
      params.pathToId,
      params.folderPaths,
    );
    if (op.type === "upsert") {
      items.push(op.item);
      if (op.item.isFolder && op.item.providerPathLower) {
        params.folderPaths.add(op.item.providerPathLower);
      }
    } else if (op.type === "remove_path") {
      removedPaths.push(op.pathLower);
    } else if (op.type === "remove_path_prefix") {
      removedPathPrefixes.push(op.pathLower);
    }
  }
  return {
    items,
    removedPaths: orderDropboxPathDeletes(removedPaths),
    removedPathPrefixes: orderDropboxPathDeletes(removedPathPrefixes),
    nextPageToken: params.hasMore ? params.cursor : null,
    finalChangesCursor: params.hasMore ? null : params.cursor,
  };
}

async function guardDropboxAccount(accountId: string) {
  const account = await prisma.connectedAccount.findUniqueOrThrow({
    where: { id: accountId },
  });
  if (account.dropboxNeedsFullAccess) {
    throw new Error(
      "DROPBOX_APP_FOLDER: Reconnect with Full Dropbox access before indexing.",
    );
  }
  await assertDropboxPersonalAccount(account);
  return account;
}

export const dropboxIndexAdapter: ProviderIndexAdapter = {
  provider: "dropbox",

  async getChangesStartToken() {
    return null;
  },

  ensureRootProviderId: ensureDropboxRootProviderId,

  async listIndexPage(accountId, pageToken) {
    const account = await guardDropboxAccount(accountId);
    const rootId = await ensureDropboxRootProviderId(accountId);
    const { pathToId, folderPaths } = await loadPathMap(accountId);
    const page = await fetchDropboxListFolderPage(account, {
      cursor: pageToken,
      includeDeleted: false,
    });
    return pageFromEntries({
      entries: page.entries,
      cursor: page.cursor,
      hasMore: page.hasMore,
      rootId,
      pathToId,
      folderPaths,
    });
  },

  async listChangesPage(accountId, pageToken) {
    const account = await guardDropboxAccount(accountId);
    const rootId = await ensureDropboxRootProviderId(accountId);
    const { pathToId, folderPaths } = await loadPathMap(accountId);
    const page = await fetchDropboxListFolderPage(account, {
      cursor: pageToken,
      includeDeleted: true,
    });
    return {
      ops: page.entries.map((entry) =>
        mapDropboxEntryToOp(entry, rootId, pathToId, folderPaths),
      ),
      nextPageToken: page.hasMore ? page.cursor : null,
      newStartPageToken: page.hasMore ? null : page.cursor,
    };
  },

  isInvalidListPageTokenError: isDropboxResetCursorError,
  isInvalidChangesTokenError: isDropboxResetCursorError,
  isAuthError: (error: unknown) =>
    isDropboxAuthError(error) || error instanceof DropboxTeamAccountError,
  isRateLimitedError: isDropboxRateLimitedError,
};
