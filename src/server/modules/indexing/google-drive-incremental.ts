import "server-only";

import {
  softDeleteCatalogFile,
  upsertCatalogItem,
} from "@/server/modules/indexing/catalog-upsert";
import {
  type IncrementalSyncResult,
  runIncrementalSync,
} from "@/server/modules/indexing/engine";
import {
  googleDriveIndexAdapter,
  mapGoogleDriveChangeToOp,
} from "@/server/modules/indexing/google-drive-adapter";
import type { GoogleDriveChangeRow } from "@/server/modules/providers/google/google-drive-changes";

export type { IncrementalSyncResult };

export async function applyGoogleDriveChange(params: {
  userId: string;
  connectedAccountId: string;
  change: GoogleDriveChangeRow;
}): Promise<"applied" | "ignored"> {
  const op = mapGoogleDriveChangeToOp(params.change);
  if (op.type === "ignore" || op.type === "remove_path_prefix") {
    return "ignored";
  }
  if (op.type === "remove") {
    await softDeleteCatalogFile({
      connectedAccountId: params.connectedAccountId,
      providerFileId: op.providerFileId,
    });
    return "applied";
  }
  await upsertCatalogItem({
    userId: params.userId,
    connectedAccountId: params.connectedAccountId,
    provider: "google_drive",
    item: op.item,
  });
  return "applied";
}

export type ListChangesPageFn = (params: { pageToken: string }) => Promise<{
  changes: GoogleDriveChangeRow[];
  nextPageToken: string | null;
  newStartPageToken: string | null;
}>;

/**
 * Incremental catalog sync via changes.list.
 * Saves the page token only after each batch is committed (crash replays).
 */
export async function runGoogleDriveIncrementalSync(params: {
  accountId: string;
  listChangesPage?: ListChangesPageFn;
}): Promise<IncrementalSyncResult> {
  return runIncrementalSync({
    adapter: googleDriveIndexAdapter,
    accountId: params.accountId,
    listChangesPage: params.listChangesPage
      ? async ({ pageToken }) => {
          const page = await params.listChangesPage!({ pageToken });
          return {
            ops: page.changes.map(mapGoogleDriveChangeToOp),
            nextPageToken: page.nextPageToken,
            newStartPageToken: page.newStartPageToken,
          };
        }
      : undefined,
  });
}
