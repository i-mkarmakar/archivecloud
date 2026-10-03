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
  fetchDropboxListFolderPage,
  isDropboxAuthError,
  isDropboxRateLimitedError,
  isDropboxResetCursorError,
  type DropboxListEntry,
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

export function mapDropboxEntryToOp(
  entry: DropboxListEntry,
  rootId: string,
  pathToId: Map<string, string>,
): CatalogChangeOp {
  const pathLower = entry.path_lower?.toLowerCase();
  if (!pathLower) return { type: "ignore" };

  if (entry[".tag"] === "deleted") {
    // Docs: remove entry at path and all children (path-prefix).
    return { type: "remove_path_prefix", pathLower };
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

  const isSharedMount = Boolean(entry.sharing_info?.parent_shared_folder_id);
  const notDownloadable =
    entry[".tag"] === "file" && entry.is_downloadable === false;
  const isPaper = /\.paper$/i.test(entry.name);
  const isShortcut = isSharedMount || notDownloadable || isPaper;

  const item: CatalogIndexItem = {
    id: entry.id,
    name: entry.name,
    mimeType: isFolder
      ? "application/vnd.archivecloud.folder"
      : isPaper
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
  };
  return { type: "upsert", item };
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

async function loadPathMap(accountId: string): Promise<Map<string, string>> {
  const folders = await prisma.file.findMany({
    where: {
      connectedAccountId: accountId,
      isFolder: true,
      providerPathLower: { not: null },
      status: "active",
    },
    select: { providerFileId: true, providerPathLower: true },
  });
  const map = new Map<string, string>();
  for (const folder of folders) {
    if (folder.providerPathLower) {
      map.set(folder.providerPathLower, folder.providerFileId);
    }
  }
  return map;
}

function pageFromEntries(params: {
  entries: DropboxListEntry[];
  cursor: string;
  hasMore: boolean;
  rootId: string;
  pathToId: Map<string, string>;
}): IndexPage {
  const items: CatalogIndexItem[] = [];
  const removedPathPrefixes: string[] = [];
  for (const entry of params.entries) {
    const op = mapDropboxEntryToOp(entry, params.rootId, params.pathToId);
    if (op.type === "upsert") items.push(op.item);
    else if (op.type === "remove_path_prefix") {
      removedPathPrefixes.push(op.pathLower);
    }
  }
  return {
    items,
    removedPathPrefixes,
    nextPageToken: params.hasMore ? params.cursor : null,
    finalChangesCursor: params.hasMore ? null : params.cursor,
  };
}

export const dropboxIndexAdapter: ProviderIndexAdapter = {
  provider: "dropbox",

  async getChangesStartToken() {
    return null;
  },

  ensureRootProviderId: ensureDropboxRootProviderId,

  async listIndexPage(accountId, pageToken) {
    const account = await prisma.connectedAccount.findUniqueOrThrow({
      where: { id: accountId },
    });
    if (account.dropboxNeedsFullAccess) {
      throw new Error(
        "DROPBOX_APP_FOLDER: Reconnect with Full Dropbox access before indexing.",
      );
    }
    const rootId = await ensureDropboxRootProviderId(accountId);
    const pathToId = await loadPathMap(accountId);
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
    });
  },

  async listChangesPage(accountId, pageToken) {
    const account = await prisma.connectedAccount.findUniqueOrThrow({
      where: { id: accountId },
    });
    if (account.dropboxNeedsFullAccess) {
      throw new Error(
        "DROPBOX_APP_FOLDER: Reconnect with Full Dropbox access before indexing.",
      );
    }
    const rootId = await ensureDropboxRootProviderId(accountId);
    const pathToId = await loadPathMap(accountId);
    const page = await fetchDropboxListFolderPage(account, {
      cursor: pageToken,
      includeDeleted: true,
    });
    return {
      ops: page.entries.map((entry) =>
        mapDropboxEntryToOp(entry, rootId, pathToId),
      ),
      nextPageToken: page.hasMore ? page.cursor : null,
      newStartPageToken: page.hasMore ? null : page.cursor,
    };
  },

  isInvalidListPageTokenError: isDropboxResetCursorError,
  isInvalidChangesTokenError: isDropboxResetCursorError,
  isAuthError: isDropboxAuthError,
  isRateLimitedError: isDropboxRateLimitedError,
};
