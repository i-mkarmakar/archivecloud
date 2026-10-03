import "server-only";

import { env } from "@/server/config/env";
import { prisma } from "@/server/config/prisma";
import { runDropboxIncrementalSync } from "@/server/modules/indexing/dropbox-index";
import { runGoogleDriveIncrementalSync } from "@/server/modules/indexing/google-drive-incremental";
import { runOneDriveIncrementalSync } from "@/server/modules/indexing/onedrive-index";

const pendingByAccount = new Map<string, NodeJS.Timeout>();
/** Trailing coalesce window for webhook bursts. */
export const CATALOG_SYNC_DEBOUNCE_MS = 3_000;

type SyncRunner = (accountId: string) => Promise<unknown>;

async function defaultCatalogSyncRunner(accountId: string) {
  const account = await prisma.connectedAccount.findUnique({
    where: { id: accountId },
    select: { provider: true, status: true },
  });
  if (account?.status !== "connected") return { status: "skipped" };
  if (account.provider === "google_drive") {
    return runGoogleDriveIncrementalSync({ accountId });
  }
  if (account.provider === "onedrive") {
    return runOneDriveIncrementalSync({ accountId });
  }
  if (account.provider === "dropbox") {
    return runDropboxIncrementalSync({ accountId });
  }
  return { status: "skipped" };
}

let syncRunner: SyncRunner = defaultCatalogSyncRunner;

/** Test seam. */
export function setCatalogSyncRunnerForTests(runner: SyncRunner | null) {
  syncRunner = runner ?? defaultCatalogSyncRunner;
}

/** Debounced catalog incremental sync — separate from FolderSync. Trailing. */
export function scheduleCatalogIncrementalSync(
  accountId: string,
  reason: string,
): void {
  if (!env.WHOLE_ACCOUNT_INDEXING_ENABLED) return;

  const existing = pendingByAccount.get(accountId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    pendingByAccount.delete(accountId);
    void syncRunner(accountId)
      .then((result) => {
        const status =
          result && typeof result === "object" && "status" in result
            ? (result as { status: string; reason?: string }).status
            : null;
        if (status === "failed") {
          console.error(
            `Catalog incremental sync failed (${reason}):`,
            (result as { reason?: string }).reason,
          );
        }
      })
      .catch((error) => {
        console.error("Catalog incremental sync trigger failed:", error);
      });
  }, CATALOG_SYNC_DEBOUNCE_MS);

  pendingByAccount.set(accountId, timer);
}

export function clearCatalogSyncSchedulesForTests() {
  for (const timer of pendingByAccount.values()) clearTimeout(timer);
  pendingByAccount.clear();
}
