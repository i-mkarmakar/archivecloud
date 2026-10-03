import "server-only";

import { env } from "@/server/config/env";
import { prisma } from "@/server/config/prisma";
import { dropboxIndexAdapter } from "@/server/modules/indexing/dropbox-adapter";
import {
  getIndexStatus,
  resumeStaleIndexScans,
  runIncrementalSync,
  runIndexScan,
  startNeededFullScans,
  startOrResumeIndexScan,
  type IncrementalSyncResult,
  type ListIndexPageFn,
} from "@/server/modules/indexing/engine";
import type { IndexAccountStatus } from "@/server/modules/indexing/types";

export type { IndexAccountStatus, IncrementalSyncResult };

async function afterFullScanComplete(accountId: string) {
  await runDropboxIncrementalSync({ accountId });
}

export async function startOrResumeDropboxIndex(params: {
  userId: string;
  accountId: string;
  listPage?: ListIndexPageFn;
  awaitCompletion?: boolean;
  fromCron?: boolean;
}): Promise<IndexAccountStatus | { error: string; code: string }> {
  if (!env.WHOLE_ACCOUNT_INDEXING_ENABLED) {
    return {
      code: "FEATURE_DISABLED",
      error: "Whole-account indexing is disabled.",
    };
  }

  const account = await prisma.connectedAccount.findFirst({
    where: {
      id: params.accountId,
      userId: params.userId,
      provider: "dropbox",
      status: "connected",
    },
  });
  if (!account) {
    return { code: "ACCOUNT_NOT_FOUND", error: "Connected account not found." };
  }
  if (account.dropboxNeedsFullAccess) {
    return {
      code: "DROPBOX_APP_FOLDER",
      error:
        "This Dropbox account only has App-folder access. Reconnect with Full Dropbox to index the whole account.",
    };
  }

  try {
    const { assertDropboxPersonalAccount } = await import(
      "@/server/modules/providers/dropbox/dropbox-account"
    );
    await assertDropboxPersonalAccount(account);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith("DROPBOX_TEAM")) {
      return {
        code: "DROPBOX_TEAM",
        error:
          "Dropbox Business/team accounts are not supported for whole-account indexing yet.",
      };
    }
    throw error;
  }

  return startOrResumeIndexScan({
    adapter: dropboxIndexAdapter,
    userId: params.userId,
    accountId: params.accountId,
    listPage: params.listPage,
    awaitCompletion: params.awaitCompletion,
    fromCron: params.fromCron,
    onScanComplete: afterFullScanComplete,
  });
}

export async function runDropboxIndexScan(params: {
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
    adapter: dropboxIndexAdapter,
    ...params,
    onScanComplete: afterFullScanComplete,
  });
}

export async function getDropboxIndexStatus(params: {
  userId: string;
  accountId: string;
}): Promise<IndexAccountStatus | { error: string; code: string }> {
  return getIndexStatus({
    adapter: dropboxIndexAdapter,
    ...params,
  });
}

export async function resumeStaleDropboxScans(limit = 10) {
  return resumeStaleIndexScans({
    adapter: dropboxIndexAdapter,
    limit,
    onScanComplete: afterFullScanComplete,
  });
}

export async function startNeededDropboxFullScans(limit = 10) {
  return startNeededFullScans({
    adapter: dropboxIndexAdapter,
    limit,
    onScanComplete: afterFullScanComplete,
  });
}

export async function runDropboxIncrementalSync(params: {
  accountId: string;
  listChangesPage?: Parameters<typeof runIncrementalSync>[0]["listChangesPage"];
}): Promise<IncrementalSyncResult> {
  const account = await prisma.connectedAccount.findFirst({
    where: { id: params.accountId, provider: "dropbox", status: "connected" },
  });
  if (account?.dropboxNeedsFullAccess) {
    return { status: "skipped", applied: 0, reason: "dropbox_app_folder" };
  }
  return runIncrementalSync({
    adapter: dropboxIndexAdapter,
    accountId: params.accountId,
    listChangesPage: params.listChangesPage,
  });
}
