import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const envState = vi.hoisted(() => ({
  WHOLE_ACCOUNT_INDEXING_ENABLED: true,
  INDEX_RECONCILE_MAX_REMOVAL_PCT: 20,
  INDEX_SCAN_STALE_MINUTES: 10,
  INDEX_FULL_SCAN_MAX_ATTEMPTS: 5,
  INDEX_FULL_SCAN_BACKOFF_MINUTES: 5,
  TOKEN_ENCRYPTION_KEY: "test-token-encryption-key-32b!!!!",
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

vi.mock("@/server/modules/providers/onedrive/onedrive-delta", () => ({
  fetchOneDriveDeltaPage: vi.fn(),
  isOneDriveResyncRequiredError: (error: unknown) =>
    /410|resyncRequired/i.test(
      error instanceof Error ? error.message : String(error),
    ),
  isOneDriveAuthError: (error: unknown) =>
    /token refresh failed|invalid_grant/i.test(
      error instanceof Error ? error.message : String(error),
    ),
}));

vi.mock("@/server/modules/onedrive/onedrive.service", () => ({
  getOneDriveAccessToken: vi.fn(async () => "od-token"),
}));

import { IndexRateLimitedError } from "@/server/modules/indexing/catalog-upsert";
import { mapOneDriveDeltaItem } from "@/server/modules/indexing/onedrive-adapter";
import {
  runOneDriveIncrementalSync,
  runOneDriveIndexScan,
  startOrResumeOneDriveIndex,
} from "@/server/modules/indexing/onedrive-index";

const accountBase = {
  id: "od-1",
  userId: "user-1",
  provider: "onedrive",
  status: "connected",
  scopes: [],
  indexStatus: "idle",
  indexFilesIndexed: 0,
  indexPageToken: null as string | null,
  indexScanId: null as string | null,
  indexLastError: null as string | null,
  indexStartedAt: null as Date | null,
  indexFinishedAt: null as Date | null,
  indexHeartbeatAt: null as Date | null,
  indexChangesPageToken: "https://graph.microsoft.com/deltaLink",
  indexNeedsFullScan: false,
  indexFullScanAttempts: 0,
  indexFullScanNextAttemptAt: null as Date | null,
  indexRootProviderId: "od-root-id",
};

describe("mapOneDriveDeltaItem", () => {
  it("handles out-of-order parent/child via parentReference id", () => {
    const child = mapOneDriveDeltaItem({
      id: "child",
      name: "child.txt",
      size: 10,
      file: { mimeType: "text/plain" },
      parentReference: { id: "parent-not-yet-seen" },
    });
    expect(child).toMatchObject({
      type: "upsert",
      item: { providerParentId: "parent-not-yet-seen", id: "child" },
    });
  });

  it("ignores drive root and maps deleted facet", () => {
    expect(
      mapOneDriveDeltaItem({ id: "root", root: {}, name: "root" }),
    ).toEqual({ type: "ignore" });
    expect(
      mapOneDriveDeltaItem({ id: "gone", deleted: { state: "deleted" } }),
    ).toEqual({ type: "remove", providerFileId: "gone" });
  });

  it("marks remoteItem as shortcut-like (blocked actions)", () => {
    const op = mapOneDriveDeltaItem({
      id: "local-remote",
      name: "Shared folder",
      remoteItem: { id: "remote-9" },
      parentReference: { id: "root-id" },
    });
    expect(op).toMatchObject({
      type: "upsert",
      item: {
        isShortcut: true,
        shortcutTargetId: "remote-9",
        isFolder: false,
      },
    });
  });
});

describe("runOneDriveIncrementalSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envState.WHOLE_ACCOUNT_INDEXING_ENABLED = true;
    prismaMock.connectedAccount.findFirst.mockResolvedValue({ ...accountBase });
    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock),
    );
    prismaMock.connectedAccount.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.file.upsert.mockResolvedValue({});
    prismaMock.file.findMany.mockResolvedValue([]);
  });

  it("is a no-op when indexing flag is off", async () => {
    envState.WHOLE_ACCOUNT_INDEXING_ENABLED = false;
    expect(
      await runOneDriveIncrementalSync({ accountId: "od-1" }),
    ).toMatchObject({ status: "disabled" });
  });

  it("flags needs_full_scan on 410", async () => {
    const result = await runOneDriveIncrementalSync({
      accountId: "od-1",
      listChangesPage: async () => {
        throw new Error("OneDrive delta 410 resyncRequired");
      },
    });
    expect(result.status).toBe("needs_full_scan");
    expect(prismaMock.connectedAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ indexNeedsFullScan: true }),
      }),
    );
  });

  it("is idempotent for duplicate delivery", async () => {
    const page = {
      ops: [
        {
          type: "upsert" as const,
          item: {
            id: "f1",
            name: "A",
            mimeType: "text/plain",
            sizeBytes: 1n,
            providerParentId: "p",
            isFolder: false,
            isShortcut: false,
            shortcutTargetId: null,
          },
        },
      ],
      nextPageToken: null,
      newStartPageToken: "https://graph.microsoft.com/deltaLink2",
    };
    prismaMock.connectedAccount.update.mockResolvedValue({});
    await runOneDriveIncrementalSync({
      accountId: "od-1",
      listChangesPage: async () => page,
    });
    await runOneDriveIncrementalSync({
      accountId: "od-1",
      listChangesPage: async () => page,
    });
    expect(prismaMock.file.upsert).toHaveBeenCalledTimes(2);
  });
});

describe("runOneDriveIndexScan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envState.WHOLE_ACCOUNT_INDEXING_ENABLED = true;
    prismaMock.file.count.mockResolvedValue(0);
    prismaMock.file.findMany.mockResolvedValue([]);
    prismaMock.file.upsert.mockResolvedValue({});
    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock),
    );
    prismaMock.connectedAccount.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.connectedAccount.findUnique.mockResolvedValue({
      ...accountBase,
      indexStatus: "running",
      indexScanId: "scan-od",
    });
    prismaMock.connectedAccount.findUniqueOrThrow.mockResolvedValue({
      ...accountBase,
      indexStatus: "complete",
    });
    prismaMock.connectedAccount.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        ...accountBase,
        ...data,
      }),
    );
  });

  it("resumes mid-scan from saved nextLink and stores final deltaLink", async () => {
    const tokens: Array<string | null> = [];
    const status = await runOneDriveIndexScan({
      userId: "user-1",
      accountId: "od-1",
      scanId: "scan-od",
      startPageToken: "https://graph.microsoft.com/next-2",
      startFilesIndexed: 5,
      scanStartedAt: new Date("2026-01-01T00:00:00.000Z"),
      isResume: true,
      listPage: async ({ pageToken }) => {
        tokens.push(pageToken);
        return {
          items: [
            {
              id: "f",
              name: "f",
              mimeType: "text/plain",
              sizeBytes: 1n,
              providerParentId: "p",
              isFolder: false,
              isShortcut: false,
              shortcutTargetId: null,
            },
          ],
          nextPageToken: null,
          finalChangesCursor: "https://graph.microsoft.com/delta-final",
        };
      },
    });

    expect(tokens[0]).toBe("https://graph.microsoft.com/next-2");
    expect(status.indexStatus).toBe("complete");
    expect(prismaMock.connectedAccount.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          indexChangesPageToken: "https://graph.microsoft.com/delta-final",
          indexFullScanAttempts: 0,
        }),
      }),
    );
  });

  it("on 410 during resumed full scan: one clean restart then fail", async () => {
    let currentScanId = "scan-od";
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

    const status = await runOneDriveIndexScan({
      userId: "user-1",
      accountId: "od-1",
      scanId: "scan-od",
      startPageToken: "https://graph.microsoft.com/expired-next",
      startFilesIndexed: 3,
      scanStartedAt: new Date(),
      isResume: true,
      listPage: async () => {
        throw new Error("OneDrive delta 410 resyncRequired");
      },
    });

    expect(status.indexStatus).toBe("failed");
    expect(status.indexLastError).toMatch(/410|resyncRequired/i);
  });

  it("pauses scan when 429/503 retries are exhausted (resumable)", async () => {
    prismaMock.connectedAccount.findUniqueOrThrow.mockResolvedValue({
      ...accountBase,
      indexStatus: "paused",
      indexScanId: "scan-od",
      indexPageToken: "https://graph.microsoft.com/next-2",
    });
    const status = await runOneDriveIndexScan({
      userId: "user-1",
      accountId: "od-1",
      scanId: "scan-od",
      startPageToken: "https://graph.microsoft.com/next-2",
      startFilesIndexed: 5,
      scanStartedAt: new Date(),
      isResume: true,
      listPage: async () => {
        throw new IndexRateLimitedError(
          "OneDrive delta throttled after 6 retries (429).",
        );
      },
    });
    expect(status.indexStatus).toBe("paused");
    expect(prismaMock.connectedAccount.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          indexStatus: "paused",
        }),
      }),
    );
  });
});

describe("startOrResumeOneDriveIndex", () => {
  it("no-ops when flag off", async () => {
    envState.WHOLE_ACCOUNT_INDEXING_ENABLED = false;
    expect(
      await startOrResumeOneDriveIndex({
        userId: "user-1",
        accountId: "od-1",
      }),
    ).toMatchObject({ code: "FEATURE_DISABLED" });
  });
});
