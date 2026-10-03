import "server-only";

import { randomUUID } from "node:crypto";
import { env } from "@/server/config/env";
import { prisma } from "@/server/config/prisma";
import {
  IndexRateLimitedError,
  softDeleteCatalogFilesWhere,
  writeFullScanPageGuarded,
  writeIncrementalBatchGuarded,
} from "@/server/modules/indexing/catalog-upsert";
import type {
  IndexAccountStatus,
  IndexPage,
  ProviderIndexAdapter,
} from "@/server/modules/indexing/types";
import { accountNeedsReconnect } from "@/server/modules/providers/scopes";

export type ListIndexPageFn = (params: {
  pageToken: string | null;
}) => Promise<IndexPage>;

export function scanStaleMs() {
  return env.INDEX_SCAN_STALE_MINUTES * 60_000;
}

export function isScanLockFresh(heartbeatAt: Date | null | undefined): boolean {
  if (!heartbeatAt) return false;
  return Date.now() - heartbeatAt.getTime() < scanStaleMs();
}

export function serializeIndexStatus(account: {
  indexStatus: string;
  indexFilesIndexed: number;
  indexLastError: string | null;
  indexStartedAt: Date | null;
  indexFinishedAt: Date | null;
  indexPageToken: string | null;
  indexScanId: string | null;
  indexNeedsFullScan?: boolean;
  indexFullScanAttempts?: number;
  indexHeartbeatAt?: Date | null;
}): IndexAccountStatus {
  return {
    indexStatus: account.indexStatus,
    indexFilesIndexed: account.indexFilesIndexed,
    indexLastError: account.indexLastError,
    indexStartedAt: account.indexStartedAt?.toISOString() ?? null,
    indexFinishedAt: account.indexFinishedAt?.toISOString() ?? null,
    indexPageToken: account.indexPageToken,
    indexScanId: account.indexScanId,
    indexNeedsFullScan: Boolean(account.indexNeedsFullScan),
    indexFullScanAttempts: account.indexFullScanAttempts ?? 0,
    indexHeartbeatAt: account.indexHeartbeatAt?.toISOString() ?? null,
  };
}

export async function reconcileAfterScan(params: {
  connectedAccountId: string;
  scanId: string;
  scanStartedAt: Date;
}): Promise<
  | { ok: true; removed: number }
  | {
      ok: false;
      reason: "reconcile_aborted";
      wouldRemove: number;
      total: number;
    }
> {
  const total = await prisma.file.count({
    where: {
      connectedAccountId: params.connectedAccountId,
      status: "active",
      deletedAt: null,
    },
  });
  if (total === 0) return { ok: true, removed: 0 };

  const staleWhere = {
    connectedAccountId: params.connectedAccountId,
    status: "active" as const,
    deletedAt: null,
    createdAt: { lt: params.scanStartedAt },
    updatedAt: { lt: params.scanStartedAt },
    OR: [
      { lastIndexScanId: null },
      { lastIndexScanId: { not: params.scanId } },
    ],
  };

  const stale = await prisma.file.count({ where: staleWhere });
  const pct = (stale / total) * 100;
  if (pct > env.INDEX_RECONCILE_MAX_REMOVAL_PCT) {
    return {
      ok: false,
      reason: "reconcile_aborted",
      wouldRemove: stale,
      total,
    };
  }

  const removed = await softDeleteCatalogFilesWhere(staleWhere);
  return { ok: true, removed };
}

async function markAuthError(accountId: string, message: string) {
  await prisma.connectedAccount.update({
    where: { id: accountId },
    data: {
      indexStatus: "auth_error",
      indexLastError: message,
      indexFinishedAt: new Date(),
      indexHeartbeatAt: new Date(),
    },
  });
}

export async function startOrResumeIndexScan(params: {
  adapter: ProviderIndexAdapter;
  userId: string;
  accountId: string;
  listPage?: ListIndexPageFn;
  fetchChangesStartToken?: () => Promise<string | null>;
  awaitCompletion?: boolean;
  fromCron?: boolean;
  onScanComplete?: (accountId: string) => void | Promise<void>;
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
      provider: params.adapter.provider,
      status: "connected",
    },
  });
  if (!account) {
    return { code: "ACCOUNT_NOT_FOUND", error: "Connected account not found." };
  }

  const reconnect = accountNeedsReconnect(account, {
    wholeAccountIndexingEnabled: env.WHOLE_ACCOUNT_INDEXING_ENABLED,
  });
  if (reconnect.needsReconnect) {
    return {
      code: "NEEDS_RECONNECT",
      error: "Account needs reconnect before indexing.",
    };
  }

  if (account.indexStatus === "auth_error") {
    return {
      code: "AUTH_ERROR",
      error:
        account.indexLastError ??
        "Token refresh failed. Reconnect this account.",
    };
  }

  const cutoff = new Date(Date.now() - scanStaleMs());
  const resuming =
    Boolean(account.indexScanId) &&
    (account.indexStatus === "paused" ||
      (account.indexStatus === "running" &&
        !isScanLockFresh(account.indexHeartbeatAt)));

  const scanId = resuming ? account.indexScanId! : randomUUID();
  const pageToken = resuming ? account.indexPageToken : null;
  const filesIndexed = resuming ? account.indexFilesIndexed : 0;
  const startedAt = resuming
    ? (account.indexStartedAt ?? new Date())
    : new Date();

  const locked = await prisma.connectedAccount.updateMany({
    where: {
      id: account.id,
      userId: params.userId,
      status: "connected",
      OR: [
        { indexStatus: { not: "running" } },
        { indexHeartbeatAt: null },
        { indexHeartbeatAt: { lt: cutoff } },
      ],
    },
    data: {
      indexStatus: "running",
      indexScanId: scanId,
      indexPageToken: pageToken,
      indexFilesIndexed: filesIndexed,
      indexLastError: null,
      indexStartedAt: startedAt,
      indexFinishedAt: null,
      indexHeartbeatAt: new Date(),
      indexNeedsFullScan: false,
      ...(params.fromCron
        ? {
            indexFullScanAttempts: { increment: 1 },
            indexFullScanNextAttemptAt: new Date(
              Date.now() +
                env.INDEX_FULL_SCAN_BACKOFF_MINUTES *
                  60_000 *
                  2 ** Math.min(account.indexFullScanAttempts, 8),
            ),
          }
        : {
            indexFullScanAttempts: 0,
            indexFullScanNextAttemptAt: null,
          }),
    },
  });

  if (locked.count === 0) {
    return {
      code: "SCAN_IN_PROGRESS",
      error: "A full scan is already running for this account.",
    };
  }

  if (!resuming) {
    await prisma.file.updateMany({
      where: {
        connectedAccountId: account.id,
        status: "active",
        deletedAt: null,
      },
      data: { lastIndexScanId: null },
    });
  }

  const run = () =>
    runIndexScan({
      adapter: params.adapter,
      userId: params.userId,
      accountId: account.id,
      scanId,
      startPageToken: pageToken,
      startFilesIndexed: filesIndexed,
      scanStartedAt: startedAt,
      listPage: params.listPage,
      fetchChangesStartToken: params.fetchChangesStartToken,
      isResume: resuming,
      onScanComplete: params.onScanComplete,
    });

  if (params.awaitCompletion) {
    await run();
  } else {
    void run().catch(async (error) => {
      const message =
        error instanceof Error ? error.message : "Index scan failed.";
      if (params.adapter.isAuthError(error)) {
        await markAuthError(account.id, message).catch(() => undefined);
        return;
      }
      await prisma.connectedAccount
        .update({
          where: { id: account.id },
          data: {
            indexStatus: "failed",
            indexLastError: message,
            indexFinishedAt: new Date(),
            indexHeartbeatAt: new Date(),
          },
        })
        .catch(() => undefined);
    });
  }

  const fresh = await prisma.connectedAccount.findUniqueOrThrow({
    where: { id: account.id },
  });
  return serializeIndexStatus(fresh);
}

export async function runIndexScan(params: {
  adapter: ProviderIndexAdapter;
  userId: string;
  accountId: string;
  scanId: string;
  startPageToken: string | null;
  startFilesIndexed: number;
  scanStartedAt: Date;
  listPage?: ListIndexPageFn;
  fetchChangesStartToken?: () => Promise<string | null>;
  isResume?: boolean;
  onScanComplete?: (accountId: string) => void | Promise<void>;
}): Promise<IndexAccountStatus> {
  const listPage =
    params.listPage ??
    ((args: { pageToken: string | null }) =>
      params.adapter.listIndexPage(params.accountId, args.pageToken));

  let pageToken: string | null = params.startPageToken;
  let filesIndexed = params.startFilesIndexed;
  let fetchedChangesToken = false;
  let scanId = params.scanId;
  let scanStartedAt = params.scanStartedAt;
  let isResume = Boolean(params.isResume);
  let listTokenRestarts = 0;
  let finalChangesCursor: string | null = null;

  const restartClean = async () => {
    scanId = randomUUID();
    pageToken = null;
    filesIndexed = 0;
    scanStartedAt = new Date();
    isResume = false;
    fetchedChangesToken = false;
    finalChangesCursor = null;
    await prisma.file.updateMany({
      where: {
        connectedAccountId: params.accountId,
        status: "active",
        deletedAt: null,
      },
      data: { lastIndexScanId: null },
    });
    const updated = await prisma.connectedAccount.updateMany({
      where: {
        id: params.accountId,
        status: "connected",
      },
      data: {
        indexStatus: "running",
        indexScanId: scanId,
        indexPageToken: null,
        indexFilesIndexed: 0,
        indexStartedAt: scanStartedAt,
        indexFinishedAt: null,
        indexHeartbeatAt: new Date(),
        indexChangesPageToken: null,
        indexLastError: null,
      },
    });
    if (updated.count === 0) {
      throw new Error("Scan stopped: account disconnected.");
    }
  };

  try {
    await params.adapter.ensureRootProviderId(params.accountId);

    for (;;) {
      const live = await prisma.connectedAccount.findUnique({
        where: { id: params.accountId },
      });
      if (live?.status !== "connected" || live.indexScanId !== scanId) {
        return serializeIndexStatus(
          live ?? {
            indexStatus: "idle",
            indexFilesIndexed: filesIndexed,
            indexLastError: "Scan stopped.",
            indexStartedAt: scanStartedAt,
            indexFinishedAt: new Date(),
            indexPageToken: null,
            indexScanId: null,
            indexNeedsFullScan: false,
            indexFullScanAttempts: 0,
            indexHeartbeatAt: new Date(),
          },
        );
      }

      // Google: store start token before first page. OneDrive: null → wait for final cursor.
      if (!fetchedChangesToken && pageToken === null) {
        if (!isResume || !live.indexChangesPageToken) {
          const token = params.fetchChangesStartToken
            ? await params.fetchChangesStartToken()
            : await params.adapter.getChangesStartToken(params.accountId);
          if (token) {
            const stored = await prisma.connectedAccount.updateMany({
              where: {
                id: params.accountId,
                status: "connected",
                indexScanId: scanId,
              },
              data: {
                indexChangesPageToken: token,
                indexHeartbeatAt: new Date(),
              },
            });
            if (stored.count === 0) {
              return serializeIndexStatus(live);
            }
          }
        }
        fetchedChangesToken = true;
      }

      let page: IndexPage;
      try {
        page = await listPage({ pageToken });
      } catch (error) {
        if (params.adapter.isInvalidListPageTokenError(error)) {
          // At most one clean restart per scan attempt.
          if (listTokenRestarts >= 1) {
            const message =
              error instanceof Error
                ? error.message
                : "List page token invalid after restart.";
            const updated = await prisma.connectedAccount.update({
              where: { id: params.accountId },
              data: {
                indexStatus: "failed",
                indexLastError: message,
                indexFinishedAt: new Date(),
                indexHeartbeatAt: new Date(),
              },
            });
            return serializeIndexStatus(updated);
          }
          if (isResume && pageToken) {
            listTokenRestarts += 1;
            await restartClean();
            continue;
          }
        }
        throw error;
      }

      filesIndexed += page.items.length;
      if (page.finalChangesCursor) {
        finalChangesCursor = page.finalChangesCursor;
      }

      const write = await writeFullScanPageGuarded({
        userId: params.userId,
        connectedAccountId: params.accountId,
        provider: params.adapter.provider,
        scanId,
        items: page.items,
        removedProviderFileIds: page.removedProviderFileIds,
        removedPathPrefixes: page.removedPathPrefixes,
        indexFilesIndexed: filesIndexed,
        indexPageToken: page.nextPageToken,
      });
      if (write === "aborted") {
        const after = await prisma.connectedAccount.findUnique({
          where: { id: params.accountId },
        });
        return serializeIndexStatus(
          after ?? {
            indexStatus: "idle",
            indexFilesIndexed: filesIndexed,
            indexLastError: "Scan stopped.",
            indexStartedAt: scanStartedAt,
            indexFinishedAt: new Date(),
            indexPageToken: null,
            indexScanId: null,
            indexNeedsFullScan: false,
            indexFullScanAttempts: 0,
            indexHeartbeatAt: new Date(),
          },
        );
      }

      if (!page.nextPageToken) break;
      pageToken = page.nextPageToken;
      isResume = true;
    }

    const reconcile = await reconcileAfterScan({
      connectedAccountId: params.accountId,
      scanId,
      scanStartedAt,
    });

    if (!reconcile.ok) {
      const updated = await prisma.connectedAccount.updateMany({
        where: {
          id: params.accountId,
          status: "connected",
          indexScanId: scanId,
        },
        data: {
          indexStatus: "reconcile_aborted",
          indexLastError: `Reconcile aborted: would remove ${reconcile.wouldRemove}/${reconcile.total} rows (>${env.INDEX_RECONCILE_MAX_REMOVAL_PCT}%).`,
          indexPageToken: null,
          indexFinishedAt: new Date(),
          indexFilesIndexed: filesIndexed,
          indexHeartbeatAt: new Date(),
        },
      });
      const fresh = await prisma.connectedAccount.findUniqueOrThrow({
        where: { id: params.accountId },
      });
      if (updated.count === 0) return serializeIndexStatus(fresh);
      return serializeIndexStatus(fresh);
    }

    const completeData: Record<string, unknown> = {
      indexStatus: "complete",
      indexLastError: null,
      indexPageToken: null,
      indexFinishedAt: new Date(),
      indexFilesIndexed: filesIndexed,
      indexHeartbeatAt: new Date(),
      indexNeedsFullScan: false,
      indexFullScanAttempts: 0,
      indexFullScanNextAttemptAt: null,
    };
    if (finalChangesCursor) {
      completeData.indexChangesPageToken = finalChangesCursor;
    }

    const completed = await prisma.connectedAccount.updateMany({
      where: {
        id: params.accountId,
        status: "connected",
        indexScanId: scanId,
      },
      data: completeData,
    });
    const updated = await prisma.connectedAccount.findUniqueOrThrow({
      where: { id: params.accountId },
    });
    if (completed.count === 0) {
      return serializeIndexStatus(updated);
    }

    if (params.onScanComplete) {
      try {
        await params.onScanComplete(params.accountId);
      } catch (error) {
        console.error("Post-scan incremental sync failed:", error);
      }
    }

    return serializeIndexStatus(updated);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Index scan failed.";
    const rateLimited =
      error instanceof IndexRateLimitedError ||
      Boolean(params.adapter.isRateLimitedError?.(error));
    if (rateLimited) {
      // Keep page token / scanId; cron or manual start resumes. No attempt bump.
      await prisma.connectedAccount.updateMany({
        where: {
          id: params.accountId,
          status: "connected",
          indexScanId: scanId,
        },
        data: {
          indexStatus: "paused",
          indexLastError: message,
          indexFilesIndexed: filesIndexed,
          indexHeartbeatAt: new Date(),
        },
      });
      const fresh = await prisma.connectedAccount.findUniqueOrThrow({
        where: { id: params.accountId },
      });
      return serializeIndexStatus(fresh);
    }
    if (params.adapter.isAuthError(error)) {
      await markAuthError(params.accountId, message);
      const fresh = await prisma.connectedAccount.findUniqueOrThrow({
        where: { id: params.accountId },
      });
      return serializeIndexStatus(fresh);
    }
    const failed = await prisma.connectedAccount.updateMany({
      where: {
        id: params.accountId,
        status: "connected",
        indexScanId: scanId,
      },
      data: {
        indexStatus: "failed",
        indexLastError: message,
        indexFinishedAt: new Date(),
        indexFilesIndexed: filesIndexed,
        indexHeartbeatAt: new Date(),
      },
    });
    const updated = await prisma.connectedAccount.findUniqueOrThrow({
      where: { id: params.accountId },
    });
    if (failed.count === 0) return serializeIndexStatus(updated);
    return serializeIndexStatus(updated);
  }
}

export async function getIndexStatus(params: {
  adapter: ProviderIndexAdapter;
  userId: string;
  accountId: string;
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
      provider: params.adapter.provider,
      status: "connected",
    },
  });
  if (!account) {
    return { code: "ACCOUNT_NOT_FOUND", error: "Connected account not found." };
  }
  return serializeIndexStatus(account);
}

export async function resumeStaleIndexScans(params: {
  adapter: ProviderIndexAdapter;
  limit?: number;
  onScanComplete?: (accountId: string) => void | Promise<void>;
}) {
  if (!env.WHOLE_ACCOUNT_INDEXING_ENABLED) {
    return { resumed: 0 };
  }
  const cutoff = new Date(Date.now() - scanStaleMs());
  const stale = await prisma.connectedAccount.findMany({
    where: {
      provider: params.adapter.provider,
      status: "connected",
      OR: [
        { indexStatus: "paused" },
        {
          indexStatus: "running",
          OR: [
            { indexHeartbeatAt: null },
            { indexHeartbeatAt: { lt: cutoff } },
          ],
        },
      ],
    },
    take: params.limit ?? 10,
  });

  let resumed = 0;
  for (const account of stale) {
    const reconnect = accountNeedsReconnect(account, {
      wholeAccountIndexingEnabled: true,
    });
    if (reconnect.needsReconnect) continue;

    const result = await startOrResumeIndexScan({
      adapter: params.adapter,
      userId: account.userId,
      accountId: account.id,
      onScanComplete: params.onScanComplete,
    });
    if (!("error" in result)) resumed += 1;
  }
  return { resumed };
}

export async function startNeededFullScans(params: {
  adapter: ProviderIndexAdapter;
  limit?: number;
  onScanComplete?: (accountId: string) => void | Promise<void>;
}) {
  if (!env.WHOLE_ACCOUNT_INDEXING_ENABLED) {
    return { started: 0 };
  }
  const now = new Date();
  const accounts = await prisma.connectedAccount.findMany({
    where: {
      provider: params.adapter.provider,
      status: "connected",
      indexNeedsFullScan: true,
      indexStatus: { notIn: ["running", "auth_error"] },
      indexFullScanAttempts: { lt: env.INDEX_FULL_SCAN_MAX_ATTEMPTS },
      OR: [
        { indexFullScanNextAttemptAt: null },
        { indexFullScanNextAttemptAt: { lte: now } },
      ],
    },
    take: params.limit ?? 10,
    orderBy: { indexFullScanNextAttemptAt: "asc" },
  });

  let started = 0;
  for (const account of accounts) {
    const reconnect = accountNeedsReconnect(account, {
      wholeAccountIndexingEnabled: true,
    });
    if (reconnect.needsReconnect) continue;

    const result = await startOrResumeIndexScan({
      adapter: params.adapter,
      userId: account.userId,
      accountId: account.id,
      fromCron: true,
      onScanComplete: params.onScanComplete,
    });
    if (!("error" in result)) started += 1;
  }
  return { started };
}

export type IncrementalSyncResult = {
  status: "ok" | "skipped" | "needs_full_scan" | "failed" | "disabled";
  applied: number;
  reason?: string;
};

export async function runIncrementalSync(params: {
  adapter: ProviderIndexAdapter;
  accountId: string;
  listChangesPage?: (args: { pageToken: string }) => Promise<{
    ops: import("@/server/modules/indexing/types").CatalogChangeOp[];
    nextPageToken: string | null;
    newStartPageToken: string | null;
  }>;
}): Promise<IncrementalSyncResult> {
  if (!env.WHOLE_ACCOUNT_INDEXING_ENABLED) {
    return { status: "disabled", applied: 0 };
  }

  const account = await prisma.connectedAccount.findFirst({
    where: {
      id: params.accountId,
      provider: params.adapter.provider,
      status: "connected",
    },
  });
  if (!account) {
    return { status: "failed", applied: 0, reason: "account_not_found" };
  }

  const reconnect = accountNeedsReconnect(account, {
    wholeAccountIndexingEnabled: true,
  });
  if (reconnect.needsReconnect) {
    return { status: "skipped", applied: 0, reason: "needs_reconnect" };
  }

  if (account.indexStatus === "auth_error") {
    return { status: "skipped", applied: 0, reason: "auth_error" };
  }

  if (
    account.indexStatus === "running" &&
    isScanLockFresh(account.indexHeartbeatAt)
  ) {
    return {
      status: "skipped",
      applied: 0,
      reason: "full_scan_running",
    };
  }

  if (account.indexNeedsFullScan) {
    return {
      status: "needs_full_scan",
      applied: 0,
      reason: "flagged",
    };
  }

  let pageToken = account.indexChangesPageToken;
  if (!pageToken) {
    return {
      status: "needs_full_scan",
      applied: 0,
      reason: "missing_changes_token",
    };
  }

  const listPage =
    params.listChangesPage ??
    ((args: { pageToken: string }) =>
      params.adapter.listChangesPage(params.accountId, args.pageToken));

  let applied = 0;

  try {
    for (;;) {
      const page = await listPage({ pageToken });
      const ops = page.ops.filter(
        (
          op,
        ): op is
          | {
              type: "upsert";
              item: import("@/server/modules/indexing/catalog-upsert").CatalogIndexItem;
            }
          | { type: "remove"; providerFileId: string }
          | { type: "remove_path_prefix"; pathLower: string } =>
          op.type === "upsert" ||
          op.type === "remove" ||
          op.type === "remove_path_prefix",
      );
      applied += ops.length;

      const nextToken = page.nextPageToken ?? page.newStartPageToken;
      if (!nextToken) {
        // Empty terminal page with no token — nothing to commit.
        break;
      }

      const write = await writeIncrementalBatchGuarded({
        userId: account.userId,
        connectedAccountId: account.id,
        provider: params.adapter.provider,
        ops,
        nextChangesToken: nextToken,
      });
      if (write === "aborted") {
        return { status: "skipped", applied, reason: "disconnected" };
      }
      pageToken = nextToken;

      if (!page.nextPageToken) break;
    }

    return { status: "ok", applied };
  } catch (error) {
    if (
      error instanceof IndexRateLimitedError ||
      params.adapter.isRateLimitedError?.(error)
    ) {
      return {
        status: "skipped",
        applied,
        reason: "rate_limited",
      };
    }
    if (params.adapter.isAuthError(error)) {
      await markAuthError(
        account.id,
        error instanceof Error ? error.message : "Auth error during sync.",
      );
      return { status: "failed", applied, reason: "auth_error" };
    }
    if (params.adapter.isInvalidChangesTokenError(error)) {
      await prisma.connectedAccount.update({
        where: { id: account.id },
        data: {
          indexNeedsFullScan: true,
          indexLastError:
            "Changes token invalid or expired. A full index scan is required.",
          indexFullScanNextAttemptAt: new Date(),
        },
      });
      return {
        status: "needs_full_scan",
        applied,
        reason: "token_invalid",
      };
    }
    const message =
      error instanceof Error ? error.message : "Incremental sync failed.";
    return { status: "failed", applied, reason: message };
  }
}

export function disconnectedIndexResetData() {
  return {
    indexStatus: "idle",
    indexFilesIndexed: 0,
    indexPageToken: null,
    indexScanId: null,
    indexLastError: null,
    indexStartedAt: null,
    indexFinishedAt: null,
    indexHeartbeatAt: null,
    indexChangesPageToken: null,
    indexNeedsFullScan: false,
    indexFullScanAttempts: 0,
    indexFullScanNextAttemptAt: null,
    indexRootProviderId: null,
  };
}
