import "server-only";

import { prisma } from "@/server/config/prisma";
import {
  type CatalogIndexItem,
  IndexRateLimitedError,
} from "@/server/modules/indexing/catalog-upsert";
import type {
  CatalogChangeOp,
  IndexPage,
  ProviderIndexAdapter,
} from "@/server/modules/indexing/types";
import { getOneDriveAccessToken } from "@/server/modules/onedrive/onedrive.service";
import {
  fetchOneDriveDeltaPage,
  isOneDriveAuthError,
  isOneDriveResyncRequiredError,
  type OneDriveDeltaItem,
} from "@/server/modules/providers/onedrive/onedrive-delta";

const GRAPH = "https://graph.microsoft.com/v1.0";

const PACKAGE_MIME = "application/onenote";

/** Map a Graph driveItem (delta) into a catalog row or remove/ignore. */
export function mapOneDriveDeltaItem(item: OneDriveDeltaItem): CatalogChangeOp {
  if (!item.id) return { type: "ignore" };

  if (item.deleted) {
    return { type: "remove", providerFileId: item.id };
  }

  // Drive root — not a user file/folder row.
  if (item.root) {
    return { type: "ignore" };
  }

  const name = item.name?.trim();
  if (!name) return { type: "ignore" };

  const isRemote = Boolean(item.remoteItem);
  const isFolder = Boolean(item.folder) && !isRemote;
  const mimeType = isRemote
    ? "application/vnd.archivecloud.remote-item"
    : isFolder
      ? "application/vnd.archivecloud.folder"
      : (item.file?.mimeType ?? "application/octet-stream");

  const sizeBytes =
    item.size == null || isFolder || isRemote
      ? null
      : BigInt(Math.max(0, Math.trunc(item.size)));

  // parentReference.id is the provider parent; no need for parent row to exist first.
  const providerParentId = item.parentReference?.id ?? null;

  const catalog: CatalogIndexItem = {
    id: item.id,
    name,
    mimeType:
      !isRemote && !isFolder && mimeType.includes("onenote")
        ? PACKAGE_MIME
        : mimeType,
    sizeBytes,
    providerParentId,
    isFolder,
    isShortcut: isRemote,
    shortcutTargetId: isRemote ? (item.remoteItem?.id ?? null) : null,
  };

  return { type: "upsert", item: catalog };
}

function pageFromDelta(params: {
  items: OneDriveDeltaItem[];
  nextLink: string | null;
  deltaLink: string | null;
}): IndexPage {
  const upserts: CatalogIndexItem[] = [];
  const removed: string[] = [];
  for (const raw of params.items) {
    const op = mapOneDriveDeltaItem(raw);
    if (op.type === "upsert") upserts.push(op.item);
    else if (op.type === "remove") removed.push(op.providerFileId);
  }
  return {
    items: upserts,
    removedProviderFileIds: removed,
    nextPageToken: params.nextLink,
    finalChangesCursor: params.nextLink ? null : params.deltaLink,
  };
}

async function ensureOneDriveRootProviderId(
  accountId: string,
): Promise<string> {
  const account = await prisma.connectedAccount.findUniqueOrThrow({
    where: { id: accountId },
  });
  if (account.indexRootProviderId) return account.indexRootProviderId;
  const accessToken = await getOneDriveAccessToken(account);
  const response = await fetch(`${GRAPH}/me/drive/root?$select=id`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`OneDrive root id fetch failed: ${await response.text()}`);
  }
  const data = (await response.json()) as { id?: string };
  if (!data.id) throw new Error("OneDrive root id missing.");
  await prisma.connectedAccount.update({
    where: { id: accountId },
    data: { indexRootProviderId: data.id },
  });
  return data.id;
}

export const oneDriveIndexAdapter: ProviderIndexAdapter = {
  provider: "onedrive",

  // Full enum yields deltaLink only at the end.
  async getChangesStartToken() {
    return null;
  },

  ensureRootProviderId: ensureOneDriveRootProviderId,

  async listIndexPage(accountId, pageToken) {
    const account = await prisma.connectedAccount.findUniqueOrThrow({
      where: { id: accountId },
    });
    const page = await fetchOneDriveDeltaPage(account, pageToken);
    return pageFromDelta({
      items: page.value,
      nextLink: page.nextLink,
      deltaLink: page.deltaLink,
    });
  },

  async listChangesPage(accountId, pageToken) {
    const account = await prisma.connectedAccount.findUniqueOrThrow({
      where: { id: accountId },
    });
    const page = await fetchOneDriveDeltaPage(account, pageToken);
    return {
      ops: page.value.map(mapOneDriveDeltaItem),
      nextPageToken: page.nextLink,
      newStartPageToken: page.deltaLink,
    };
  },

  // OneDrive full enum uses nextLink URLs; treat broken links like resync.
  isInvalidListPageTokenError: isOneDriveResyncRequiredError,
  isInvalidChangesTokenError: isOneDriveResyncRequiredError,
  isAuthError: isOneDriveAuthError,
  isRateLimitedError: (error) => error instanceof IndexRateLimitedError,
};
