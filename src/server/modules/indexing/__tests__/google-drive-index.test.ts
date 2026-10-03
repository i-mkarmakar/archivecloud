import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const envState = vi.hoisted(() => ({
  WHOLE_ACCOUNT_INDEXING_ENABLED: true,
  INDEX_RECONCILE_MAX_REMOVAL_PCT: 20,
  INDEX_SCAN_STALE_MINUTES: 10,
  INDEX_FULL_SCAN_MAX_ATTEMPTS: 5,
  INDEX_FULL_SCAN_BACKOFF_MINUTES: 5,
}));

vi.mock("@/server/config/env", () => ({
  env: envState,
}));

const prismaMock = vi.hoisted(() => ({
  connectedAccount: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  },
  file: {
    upsert: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
  },
  fileShare: { updateMany: vi.fn() },
  filePreviewToken: { deleteMany: vi.fn() },
  workspaceInvite: { updateMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/server/config/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/server/modules/providers/scopes", () => ({
  accountNeedsReconnect: () => ({ needsReconnect: false, reason: null }),
}));

vi.mock("@/server/modules/providers/google/google.service", () => ({
  getAuthedGoogleClient: vi.fn(),
}));

vi.mock("@/server/modules/providers/google/google-drive-changes", () => ({
  getGoogleDriveChangesStartPageToken: vi.fn(async () => "changes-start"),
  listGoogleDriveChangesPage: vi.fn(),
  isInvalidGoogleChangesTokenError: vi.fn(),
  isInvalidGoogleListPageTokenError: (error: unknown) =>
    /Invalid Value|pageToken|invalidPageToken/i.test(
      error instanceof Error ? error.message : String(error),
    ),
  isGoogleAuthError: (error: unknown) =>
    /tokens are missing|invalid_grant/i.test(
      error instanceof Error ? error.message : String(error),
    ),
}));

vi.mock("@/server/modules/providers/google/google-drive-list", () => ({
  listOwnedGoogleDriveFilesPage: vi.fn(),
}));

vi.mock("@/server/modules/providers/google/google-drive-root", () => ({
  ensureGoogleDriveRootProviderId: vi.fn(async () => "root-id"),
  fetchGoogleDriveRootId: vi.fn(async () => "root-id"),
}));

vi.mock("@/server/modules/indexing/google-drive-incremental", () => ({
  runGoogleDriveIncrementalSync: vi.fn(async () => ({
    status: "ok",
    applied: 0,
  })),
}));

import {
  type DriveIndexPage,
  mapGoogleDriveFileToIndexItem,
  reconcileAfterScan,
  runGoogleDriveIndexScan,
  startNeededGoogleDriveFullScans,
  startOrResumeGoogleDriveIndex,
} from "@/server/modules/indexing/google-drive-index";

const accountBase = {
  id: "acct-1",
  userId: "user-1",
  provider: "google_drive",
  status: "connected",
  indexRootProviderId: "root-id",
  scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  dropboxNeedsFullAccess: false,
  indexStatus: "idle",
  indexFilesIndexed: 0,
  indexPageToken: null as string | null,
  indexScanId: null as string | null,
  indexLastError: null as string | null,
  indexStartedAt: null as Date | null,
  indexFinishedAt: null as Date | null,
  indexHeartbeatAt: null as Date | null,
  indexChangesPageToken: null as string | null,
  indexNeedsFullScan: false,
  indexFullScanAttempts: 0,
  indexFullScanNextAttemptAt: null as Date | null,
};

function mockTx() {
  prismaMock.$transaction.mockImplementation(
    async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock),
  );
}

describe("mapGoogleDriveFileToIndexItem", () => {
  it("marks shortcuts", () => {
    expect(
      mapGoogleDriveFileToIndexItem({
        id: "s1",
        name: "Link",
        mimeType: "application/vnd.google-apps.shortcut",
        parents: ["p"],
        shortcutDetails: { targetId: "target-9" },
      }),
    ).toMatchObject({
      isShortcut: true,
      shortcutTargetId: "target-9",
      isFolder: false,
    });
  });
});

describe("reconcileAfterScan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envState.INDEX_RECONCILE_MAX_REMOVAL_PCT = 20;
    prismaMock.file.findMany.mockResolvedValue([]);
    prismaMock.fileShare.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.filePreviewToken.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.workspaceInvite.updateMany.mockResolvedValue({ count: 0 });
  });

  it("does not reconcile rows created mid-scan", async () => {
    const startedAt = new Date("2026-01-01T00:00:00.000Z");
    prismaMock.file.count.mockResolvedValueOnce(10).mockResolvedValueOnce(0);

    await reconcileAfterScan({
      connectedAccountId: "acct-1",
      scanId: "scan-1",
      scanStartedAt: startedAt,
    });

    const where = prismaMock.file.count.mock.calls[1][0].where;
    expect(where.createdAt).toEqual({ lt: startedAt });
    expect(where.updatedAt).toEqual({ lt: startedAt });
  });
});

describe("startOrResumeGoogleDriveIndex", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTx();
    envState.WHOLE_ACCOUNT_INDEXING_ENABLED = true;
    prismaMock.file.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.file.count.mockResolvedValue(0);
    prismaMock.file.findMany.mockResolvedValue([]);
    prismaMock.connectedAccount.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.connectedAccount.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        ...accountBase,
        ...data,
      }),
    );
    prismaMock.connectedAccount.findUniqueOrThrow.mockResolvedValue({
      ...accountBase,
      indexStatus: "running",
    });
    prismaMock.connectedAccount.findUnique.mockResolvedValue({
      ...accountBase,
      indexStatus: "running",
      indexScanId: "scan-x",
    });
  });

  it("rejects concurrent start while lock heartbeat is fresh", async () => {
    prismaMock.connectedAccount.findFirst.mockResolvedValue({
      ...accountBase,
      indexStatus: "running",
      indexHeartbeatAt: new Date(),
      indexScanId: "scan-live",
      indexPageToken: "p2",
    });
    prismaMock.connectedAccount.updateMany.mockResolvedValue({ count: 0 });

    const result = await startOrResumeGoogleDriveIndex({
      userId: "user-1",
      accountId: "acct-1",
      awaitCompletion: true,
      listPage: async () => ({ items: [], nextPageToken: null }),
      fetchChangesStartToken: async () => "tok",
    });

    expect(result).toEqual({
      code: "SCAN_IN_PROGRESS",
      error: "A full scan is already running for this account.",
    });
  });

  it("atomic lock: only one concurrent start wins", async () => {
    prismaMock.connectedAccount.findFirst.mockResolvedValue({
      ...accountBase,
    });
    let updateCalls = 0;
    prismaMock.connectedAccount.updateMany.mockImplementation(async () => {
      updateCalls += 1;
      return { count: updateCalls === 1 ? 1 : 0 };
    });

    const [a, b] = await Promise.all([
      startOrResumeGoogleDriveIndex({
        userId: "user-1",
        accountId: "acct-1",
        awaitCompletion: true,
        listPage: async () => ({ items: [], nextPageToken: null }),
        fetchChangesStartToken: async () => "tok",
      }),
      startOrResumeGoogleDriveIndex({
        userId: "user-1",
        accountId: "acct-1",
        awaitCompletion: true,
        listPage: async () => ({ items: [], nextPageToken: null }),
        fetchChangesStartToken: async () => "tok",
      }),
    ]);

    const errors = [a, b].filter((r) => "error" in r);
    const wins = [a, b].filter((r) => !("error" in r));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ code: "SCAN_IN_PROGRESS" });
    expect(wins).toHaveLength(1);
  });

  it("resumes stale running scans from saved page token", async () => {
    const staleBeat = new Date(Date.now() - 60 * 60_000);
    prismaMock.connectedAccount.findFirst.mockResolvedValue({
      ...accountBase,
      indexStatus: "running",
      indexHeartbeatAt: staleBeat,
      indexScanId: "scan-stale",
      indexPageToken: "page-7",
      indexFilesIndexed: 50,
      indexStartedAt: new Date("2026-01-01T00:00:00.000Z"),
      indexChangesPageToken: "changes-existing",
    });
    prismaMock.connectedAccount.findUnique.mockResolvedValue({
      ...accountBase,
      indexStatus: "running",
      indexScanId: "scan-stale",
      indexChangesPageToken: "changes-existing",
    });

    const tokens: Array<string | null> = [];
    await startOrResumeGoogleDriveIndex({
      userId: "user-1",
      accountId: "acct-1",
      awaitCompletion: true,
      listPage: async ({ pageToken }) => {
        tokens.push(pageToken);
        return {
          items: [
            {
              id: "n1",
              name: "n",
              mimeType: "text/plain",
              sizeBytes: 1n,
              providerParentId: null,
              isFolder: false,
              isShortcut: false,
              shortcutTargetId: null,
            },
          ],
          nextPageToken: null,
        };
      },
      fetchChangesStartToken: async () => "should-not-replace",
    });

    expect(tokens[0]).toBe("page-7");
  });

  it("is a no-op when indexing flag is off", async () => {
    envState.WHOLE_ACCOUNT_INDEXING_ENABLED = false;
    const result = await startOrResumeGoogleDriveIndex({
      userId: "user-1",
      accountId: "acct-1",
    });
    expect(result).toMatchObject({ code: "FEATURE_DISABLED" });
  });
});

describe("runGoogleDriveIndexScan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTx();
    envState.WHOLE_ACCOUNT_INDEXING_ENABLED = true;
    envState.INDEX_RECONCILE_MAX_REMOVAL_PCT = 20;
    prismaMock.file.upsert.mockResolvedValue({});
    prismaMock.file.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.file.findMany.mockResolvedValue([]);
    prismaMock.file.count.mockResolvedValue(0);
    prismaMock.connectedAccount.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.connectedAccount.findUnique.mockResolvedValue({
      ...accountBase,
      indexStatus: "running",
      indexScanId: "scan-1",
    });
    prismaMock.connectedAccount.findUniqueOrThrow.mockResolvedValue({
      ...accountBase,
      indexStatus: "complete",
      indexFullScanAttempts: 0,
    });
    prismaMock.connectedAccount.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        ...accountBase,
        ...data,
      }),
    );
  });

  it("indexes outside archivecloud and stores changes start token", async () => {
    const pages: DriveIndexPage[] = [
      {
        items: [
          {
            id: "outside",
            name: "Outside.txt",
            mimeType: "text/plain",
            sizeBytes: 3n,
            providerParentId: "other",
            isFolder: false,
            isShortcut: false,
            shortcutTargetId: null,
          },
        ],
        nextPageToken: null,
      },
    ];
    let calls = 0;
    let changesTokenWrites = 0;
    prismaMock.connectedAccount.updateMany.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        if (data.indexChangesPageToken) changesTokenWrites += 1;
        return { count: 1 };
      },
    );

    const status = await runGoogleDriveIndexScan({
      userId: "user-1",
      accountId: "acct-1",
      scanId: "scan-1",
      startPageToken: null,
      startFilesIndexed: 0,
      scanStartedAt: new Date("2026-01-01T00:00:00.000Z"),
      listPage: async () => {
        const page = pages[calls] ?? { items: [], nextPageToken: null };
        calls += 1;
        return page;
      },
      fetchChangesStartToken: async () => "changes-start-token",
    });

    expect(status.indexStatus).toBe("complete");
    expect(changesTokenWrites).toBeGreaterThanOrEqual(1);
    expect(prismaMock.file.upsert).toHaveBeenCalled();
  });

  it("restarts once when a resumed list page token is invalid", async () => {
    let currentScanId = "scan-old";
    prismaMock.connectedAccount.findUnique.mockImplementation(async () => ({
      ...accountBase,
      indexStatus: "running",
      indexScanId: currentScanId,
      indexChangesPageToken: null,
    }));
    prismaMock.connectedAccount.updateMany.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        if (typeof data.indexScanId === "string") {
          currentScanId = data.indexScanId;
        }
        return { count: 1 };
      },
    );

    const tokens: Array<string | null> = [];
    const status = await runGoogleDriveIndexScan({
      userId: "user-1",
      accountId: "acct-1",
      scanId: "scan-old",
      startPageToken: "expired-page",
      startFilesIndexed: 12,
      scanStartedAt: new Date("2026-01-01T00:00:00.000Z"),
      isResume: true,
      listPage: async ({ pageToken }) => {
        tokens.push(pageToken);
        if (pageToken === "expired-page") {
          throw new Error("Invalid Value: pageToken");
        }
        return { items: [], nextPageToken: null };
      },
      fetchChangesStartToken: async () => "new-changes",
    });

    expect(tokens[0]).toBe("expired-page");
    expect(tokens.some((t) => t === null)).toBe(true);
    expect(status.indexStatus).toBe("complete");
  });

  it("fails after a second invalid list page token (no restart loop)", async () => {
    let currentScanId = "scan-old";
    prismaMock.connectedAccount.findUnique.mockImplementation(async () => ({
      ...accountBase,
      indexStatus: "running",
      indexScanId: currentScanId,
    }));
    prismaMock.connectedAccount.updateMany.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        if (typeof data.indexScanId === "string") {
          currentScanId = data.indexScanId;
        }
        return { count: 1 };
      },
    );
    prismaMock.connectedAccount.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        ...accountBase,
        ...data,
      }),
    );

    const status = await runGoogleDriveIndexScan({
      userId: "user-1",
      accountId: "acct-1",
      scanId: "scan-old",
      startPageToken: "bad-1",
      startFilesIndexed: 0,
      scanStartedAt: new Date(),
      isResume: true,
      listPage: async ({ pageToken }) => {
        throw new Error(`Invalid Value: pageToken ${pageToken ?? "null"}`);
      },
      fetchChangesStartToken: async () => "tok",
    });

    expect(status.indexStatus).toBe("failed");
    expect(status.indexLastError).toMatch(/pageToken/i);
  });

  it("aborts page writes when disconnected mid-scan (no rows left behind)", async () => {
    prismaMock.connectedAccount.findUnique.mockResolvedValue({
      ...accountBase,
      indexStatus: "running",
      indexScanId: "scan-1",
    });
    // Guarded write: updateMany for connected+scanId returns 0 → aborted.
    prismaMock.connectedAccount.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.connectedAccount.findUnique
      .mockResolvedValueOnce({
        ...accountBase,
        indexStatus: "running",
        indexScanId: "scan-1",
      })
      .mockResolvedValue({
        ...accountBase,
        status: "disconnected",
        indexScanId: null,
        indexStatus: "idle",
      });

    const status = await runGoogleDriveIndexScan({
      userId: "user-1",
      accountId: "acct-1",
      scanId: "scan-1",
      startPageToken: null,
      startFilesIndexed: 0,
      scanStartedAt: new Date(),
      listPage: async () => ({
        items: [
          {
            id: "should-not-persist",
            name: "x",
            mimeType: "text/plain",
            sizeBytes: 1n,
            providerParentId: null,
            isFolder: false,
            isShortcut: false,
            shortcutTargetId: null,
          },
        ],
        nextPageToken: null,
      }),
      fetchChangesStartToken: async () => null,
    });

    expect(prismaMock.file.upsert).not.toHaveBeenCalled();
    expect(status.indexStatus === "idle" || status.indexScanId === null).toBe(
      true,
    );
  });

  it("resets indexFullScanAttempts on successful completion", async () => {
    await runGoogleDriveIndexScan({
      userId: "user-1",
      accountId: "acct-1",
      scanId: "scan-1",
      startPageToken: null,
      startFilesIndexed: 0,
      scanStartedAt: new Date(),
      listPage: async () => ({ items: [], nextPageToken: null }),
      fetchChangesStartToken: async () => "tok",
    });

    expect(prismaMock.connectedAccount.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          indexStatus: "complete",
          indexFullScanAttempts: 0,
        }),
      }),
    );
  });
});

describe("startNeededGoogleDriveFullScans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envState.WHOLE_ACCOUNT_INDEXING_ENABLED = true;
    envState.INDEX_FULL_SCAN_MAX_ATTEMPTS = 5;
  });

  it("skips accounts that exhausted auto re-sync attempts", async () => {
    prismaMock.connectedAccount.findMany.mockResolvedValue([]);
    const result = await startNeededGoogleDriveFullScans(10);
    expect(result.started).toBe(0);
    expect(prismaMock.connectedAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          indexNeedsFullScan: true,
          indexFullScanAttempts: { lt: 5 },
        }),
      }),
    );
  });
});
