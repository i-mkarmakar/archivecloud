import "server-only";

import {
  getIndexStatus,
  isScanLockFresh,
  type ListIndexPageFn,
  reconcileAfterScan,
  resumeStaleIndexScans,
  runIndexScan,
  scanStaleMs,
  serializeIndexStatus,
  startNeededFullScans,
  startOrResumeIndexScan,
} from "@/server/modules/indexing/engine";
import {
  googleDriveIndexAdapter,
  mapGoogleDriveFileToIndexItem,
} from "@/server/modules/indexing/google-drive-adapter";
import { runGoogleDriveIncrementalSync } from "@/server/modules/indexing/google-drive-incremental";
import type {
  IndexAccountStatus,
  IndexPage,
} from "@/server/modules/indexing/types";

export type DriveIndexPageItem =
  import("@/server/modules/indexing/catalog-upsert").CatalogIndexItem;
export type DriveIndexPage = IndexPage;
export type ListDriveIndexPageFn = ListIndexPageFn;
export type { IndexAccountStatus };

export {
  isScanLockFresh,
  mapGoogleDriveFileToIndexItem,
  reconcileAfterScan,
  scanStaleMs,
  serializeIndexStatus,
};

export async function createGoogleDriveListPageFn(
  accountId: string,
): Promise<ListDriveIndexPageFn> {
  return async ({ pageToken }) =>
    googleDriveIndexAdapter.listIndexPage(accountId, pageToken);
}

async function afterFullScanComplete(accountId: string) {
  // Catch up edits made during the scan immediately (don't wait for cron).
  await runGoogleDriveIncrementalSync({ accountId });
}

export async function startOrResumeGoogleDriveIndex(params: {
  userId: string;
  accountId: string;
  listPage?: ListDriveIndexPageFn;
  fetchChangesStartToken?: () => Promise<string | null>;
  awaitCompletion?: boolean;
  fromCron?: boolean;
}): Promise<IndexAccountStatus | { error: string; code: string }> {
  return startOrResumeIndexScan({
    adapter: googleDriveIndexAdapter,
    userId: params.userId,
    accountId: params.accountId,
    listPage: params.listPage,
    fetchChangesStartToken: params.fetchChangesStartToken,
    awaitCompletion: params.awaitCompletion,
    fromCron: params.fromCron,
    onScanComplete: afterFullScanComplete,
  });
}

export async function runGoogleDriveIndexScan(params: {
  userId: string;
  accountId: string;
  scanId: string;
  startPageToken: string | null;
  startFilesIndexed: number;
  scanStartedAt: Date;
  listPage?: ListDriveIndexPageFn;
  fetchChangesStartToken?: () => Promise<string | null>;
  isResume?: boolean;
}): Promise<IndexAccountStatus> {
  return runIndexScan({
    adapter: googleDriveIndexAdapter,
    ...params,
    onScanComplete: afterFullScanComplete,
  });
}

export async function getGoogleDriveIndexStatus(params: {
  userId: string;
  accountId: string;
}): Promise<IndexAccountStatus | { error: string; code: string }> {
  return getIndexStatus({
    adapter: googleDriveIndexAdapter,
    ...params,
  });
}

export async function resumeStaleGoogleDriveScans(limit = 10) {
  return resumeStaleIndexScans({
    adapter: googleDriveIndexAdapter,
    limit,
    onScanComplete: afterFullScanComplete,
  });
}

export async function startNeededGoogleDriveFullScans(limit = 10) {
  return startNeededFullScans({
    adapter: googleDriveIndexAdapter,
    limit,
    onScanComplete: afterFullScanComplete,
  });
}
