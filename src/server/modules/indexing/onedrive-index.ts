import "server-only";

import {
  getIndexStatus,
  type IncrementalSyncResult,
  type ListIndexPageFn,
  resumeStaleIndexScans,
  runIncrementalSync,
  runIndexScan,
  startNeededFullScans,
  startOrResumeIndexScan,
} from "@/server/modules/indexing/engine";
import { oneDriveIndexAdapter } from "@/server/modules/indexing/onedrive-adapter";
import type { IndexAccountStatus } from "@/server/modules/indexing/types";

export type { IncrementalSyncResult, IndexAccountStatus };

async function afterFullScanComplete(accountId: string) {
  await runOneDriveIncrementalSync({ accountId });
}

export async function startOrResumeOneDriveIndex(params: {
  userId: string;
  accountId: string;
  listPage?: ListIndexPageFn;
  awaitCompletion?: boolean;
  fromCron?: boolean;
}): Promise<IndexAccountStatus | { error: string; code: string }> {
  return startOrResumeIndexScan({
    adapter: oneDriveIndexAdapter,
    userId: params.userId,
    accountId: params.accountId,
    listPage: params.listPage,
    awaitCompletion: params.awaitCompletion,
    fromCron: params.fromCron,
    onScanComplete: afterFullScanComplete,
  });
}

export async function runOneDriveIndexScan(params: {
  userId: string;
  accountId: string;
  scanId: string;
  startPageToken: string | null;
  startFilesIndexed: number;
  scanStartedAt: Date;
  listPage?: ListIndexPageFn;
  isResume?: boolean;
}): Promise<IndexAccountStatus> {
  return runIndexScan({
    adapter: oneDriveIndexAdapter,
    ...params,
    onScanComplete: afterFullScanComplete,
  });
}

export async function getOneDriveIndexStatus(params: {
  userId: string;
  accountId: string;
}): Promise<IndexAccountStatus | { error: string; code: string }> {
  return getIndexStatus({
    adapter: oneDriveIndexAdapter,
    ...params,
  });
}

export async function resumeStaleOneDriveScans(limit = 10) {
  return resumeStaleIndexScans({
    adapter: oneDriveIndexAdapter,
    limit,
    onScanComplete: afterFullScanComplete,
  });
}

export async function startNeededOneDriveFullScans(limit = 10) {
  return startNeededFullScans({
    adapter: oneDriveIndexAdapter,
    limit,
    onScanComplete: afterFullScanComplete,
  });
}

export async function runOneDriveIncrementalSync(params: {
  accountId: string;
  listChangesPage?: Parameters<typeof runIncrementalSync>[0]["listChangesPage"];
}): Promise<IncrementalSyncResult> {
  return runIncrementalSync({
    adapter: oneDriveIndexAdapter,
    accountId: params.accountId,
    listChangesPage: params.listChangesPage,
  });
}
