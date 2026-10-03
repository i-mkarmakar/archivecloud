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
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
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
  accountNeedsReconnect: (account: { dropboxNeedsFullAccess?: boolean }) =>
    account.dropboxNeedsFullAccess
      ? { needsReconnect: true, reason: "dropbox_full_access" }
      : { needsReconnect: false, reason: null },
}));

vi.mock("@/server/modules/providers/dropbox/dropbox-list-folder", () => ({
  fetchDropboxListFolderPage: vi.fn(),
  isDropboxResetCursorError: (error: unknown) =>
    /reset/i.test(error instanceof Error ? error.message : String(error)),
  isDropboxAuthError: (error: unknown) =>
    /invalid_access_token|401/i.test(
      error instanceof Error ? error.message : String(error),
    ),
  isDropboxRateLimitedError: (error: unknown) =>
    /too_many_requests|INDEX_RATE_LIMITED|rate limited/i.test(
      error instanceof Error ? error.message : String(error),
    ),
}));

vi.mock("@/server/modules/providers/dropbox/dropbox-account", () => ({
  assertDropboxPersonalAccount: vi.fn(async () => undefined),
  DropboxTeamAccountError: class DropboxTeamAccountError extends Error {
    constructor(message = "DROPBOX_TEAM") {
      super(message);
      this.name = "DropboxTeamAccountError";
    }
  },
  isDropboxTeamAccountError: (error: unknown) =>
    error instanceof Error && error.message.startsWith("DROPBOX_TEAM"),
}));

import { IndexRateLimitedError } from "@/server/modules/indexing/catalog-upsert";
import {
  dropboxParentPathLower,
  mapDropboxEntryToOp,
  orderDropboxPathDeletes,
} from "@/server/modules/indexing/dropbox-adapter";
import {
  runDropboxIncrementalSync,
  runDropboxIndexScan,
  startOrResumeDropboxIndex,
} from "@/server/modules/indexing/dropbox-index";
import { DROPBOX_ROOT_PROVIDER_ID } from "@/server/modules/indexing/root";

const accountBase = {
  id: "dbx-1",
  userId: "user-1",
  provider: "dropbox",
  status: "connected",
  scopes: [],
  dropboxNeedsFullAccess: false,
  indexStatus: "idle",
  indexFilesIndexed: 0,
  indexPageToken: null as string | null,
  indexScanId: null as string | null,
  indexLastError: null as string | null,
  indexStartedAt: null as Date | null,
  indexFinishedAt: null as Date | null,
  indexHeartbeatAt: null as Date | null,
  indexChangesPageToken: "cursor-final",
  indexNeedsFullScan: false,
  indexFullScanAttempts: 0,
  indexFullScanNextAttemptAt: null as Date | null,
  indexRootProviderId: DROPBOX_ROOT_PROVIDER_ID,
};

describe("mapDropboxEntryToOp", () => {
  it("maps recursive file/folder parents and top-level to synthetic root", () => {
    const pathToId = new Map<string, string>();
    const folder = mapDropboxEntryToOp(
      {
        ".tag": "folder",
        name: "Docs",
        id: "id:folder1",
        path_lower: "/docs",
      },
      DROPBOX_ROOT_PROVIDER_ID,
      pathToId,
    );
    expect(folder).toMatchObject({
      type: "upsert",
      item: {
        id: "id:folder1",
        providerParentId: DROPBOX_ROOT_PROVIDER_ID,
        providerPathLower: "/docs",
        isFolder: true,
      },
    });
    expect(pathToId.get("/docs")).toBe("id:folder1");

    const file = mapDropboxEntryToOp(
      {
        ".tag": "file",
        name: "a.txt",
        id: "id:file1",
        path_lower: "/docs/a.txt",
        size: 3,
        is_downloadable: true,
      },
      DROPBOX_ROOT_PROVIDER_ID,
      pathToId,
    );
    expect(file).toMatchObject({
      type: "upsert",
      item: {
        providerParentId: "id:folder1",
        sizeBytes: 3n,
        isShortcut: false,
      },
    });
  });

  it("uses path: placeholder when parent id not yet known; folder deletes use prefix", () => {
    const pathToId = new Map<string, string>();
    const child = mapDropboxEntryToOp(
      {
        ".tag": "file",
        name: "early.txt",
        id: "id:early",
        path_lower: "/missing/early.txt",
        size: 1,
      },
      DROPBOX_ROOT_PROVIDER_ID,
      pathToId,
    );
    expect(child).toMatchObject({
      type: "upsert",
      item: { providerParentId: "path:/missing" },
    });

    pathToId.set("/docs", "id:docs");
    expect(
      mapDropboxEntryToOp(
        {
          ".tag": "deleted",
          name: "gone",
          path_lower: "/docs",
        },
        DROPBOX_ROOT_PROVIDER_ID,
        pathToId,
        new Set(["/docs"]),
      ),
    ).toEqual({ type: "remove_path_prefix", pathLower: "/docs" });
  });

  it("uses exact-path delete for unknown/file deletions", () => {
    expect(
      mapDropboxEntryToOp(
        {
          ".tag": "deleted",
          name: "a.txt",
          path_lower: "/docs/a.txt",
        },
        DROPBOX_ROOT_PROVIDER_ID,
        new Map(),
      ),
    ).toEqual({ type: "remove_path", pathLower: "/docs/a.txt" });
  });

  it("orders path deletes longest-first", () => {
    expect(orderDropboxPathDeletes(["/a", "/a/b/c", "/a/b"])).toEqual([
      "/a/b/c",
      "/a/b",
      "/a",
    ]);
  });

  it("marks Paper / non-downloadable / shared-folder mount with blockedReason", () => {
    const pathToId = new Map<string, string>();
    const paper = mapDropboxEntryToOp(
      {
        ".tag": "file",
        name: "note.paper",
        id: "id:paper",
        path_lower: "/note.paper",
        is_downloadable: false,
      },
      DROPBOX_ROOT_PROVIDER_ID,
      pathToId,
    );
    expect(paper).toMatchObject({
      type: "upsert",
      item: {
        isShortcut: true,
        blockedReason: "paper",
        mimeType: "application/vnd.dropbox.paper",
      },
    });

    const mount = mapDropboxEntryToOp(
      {
        ".tag": "folder",
        name: "Shared",
        id: "id:shared",
        path_lower: "/shared",
        sharing_info: { shared_folder_id: "sf1" },
      },
      DROPBOX_ROOT_PROVIDER_ID,
      pathToId,
    );
    expect(mount).toMatchObject({
      type: "upsert",
      item: { blockedReason: "shared_folder", isShortcut: true },
    });

    // Nested file in a shared folder stays downloadable.
    const nested = mapDropboxEntryToOp(
      {
        ".tag": "file",
        name: "in-shared.txt",
        id: "id:nested",
        path_lower: "/shared/in-shared.txt",
        size: 1,
        is_downloadable: true,
        sharing_info: { parent_shared_folder_id: "sf1" },
      },
      DROPBOX_ROOT_PROVIDER_ID,
      pathToId,
    );
    expect(nested).toMatchObject({
      type: "upsert",
      item: { isShortcut: false, blockedReason: null },
    });
  });

  it("computes parent path_lower for move/rename", () => {
    expect(dropboxParentPathLower("/docs/sub/file.txt")).toBe("/docs/sub");
    expect(dropboxParentPathLower("/file.txt")).toBe("");
  });
});

describe("startOrResumeDropboxIndex", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envState.WHOLE_ACCOUNT_INDEXING_ENABLED = true;
  });

  it("no-ops when flag off", async () => {
    envState.WHOLE_ACCOUNT_INDEXING_ENABLED = false;
    expect(
      await startOrResumeDropboxIndex({
        userId: "user-1",
        accountId: "dbx-1",
      }),
    ).toMatchObject({ code: "FEATURE_DISABLED" });
  });

  it("refuses app-folder accounts", async () => {
    prismaMock.connectedAccount.findFirst.mockResolvedValue({
      ...accountBase,
      dropboxNeedsFullAccess: true,
    });
    expect(
      await startOrResumeDropboxIndex({
        userId: "user-1",
        accountId: "dbx-1",
      }),
    ).toMatchObject({ code: "DROPBOX_APP_FOLDER" });
  });
});

describe("runDropboxIndexScan", () => {
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
      indexScanId: "scan-dbx",
    });
    prismaMock.connectedAccount.findUniqueOrThrow.mockResolvedValue({
      ...accountBase,
      indexStatus: "complete",
      indexRootProviderId: DROPBOX_ROOT_PROVIDER_ID,
    });
    prismaMock.connectedAccount.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        ...accountBase,
        ...data,
      }),
    );
  });

  it("scans recursively across multiple pages and stores final cursor", async () => {
    const tokens: Array<string | null> = [];
    const status = await runDropboxIndexScan({
      userId: "user-1",
      accountId: "dbx-1",
      scanId: "scan-dbx",
      startPageToken: null,
      startFilesIndexed: 0,
      scanStartedAt: new Date("2026-01-01T00:00:00.000Z"),
      listPage: async ({ pageToken }) => {
        tokens.push(pageToken);
        if (!pageToken) {
          return {
            items: [
              {
                id: "id:f1",
                name: "a",
                mimeType: "text/plain",
                sizeBytes: 1n,
                providerParentId: DROPBOX_ROOT_PROVIDER_ID,
                providerPathLower: "/a",
                isFolder: false,
                isShortcut: false,
                shortcutTargetId: null,
              },
            ],
            nextPageToken: "cursor-page-2",
          };
        }
        return {
          items: [
            {
              id: "id:f2",
              name: "b",
              mimeType: "text/plain",
              sizeBytes: 2n,
              providerParentId: DROPBOX_ROOT_PROVIDER_ID,
              providerPathLower: "/b",
              isFolder: false,
              isShortcut: false,
              shortcutTargetId: null,
            },
          ],
          nextPageToken: null,
          finalChangesCursor: "cursor-final",
        };
      },
    });

    expect(tokens).toEqual([null, "cursor-page-2"]);
    expect(status.indexStatus).toBe("complete");
    expect(prismaMock.connectedAccount.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          indexChangesPageToken: "cursor-final",
        }),
      }),
    );
  });

  it("resumes from has_more cursor mid-scan", async () => {
    const tokens: Array<string | null> = [];
    await runDropboxIndexScan({
      userId: "user-1",
      accountId: "dbx-1",
      scanId: "scan-dbx",
      startPageToken: "cursor-mid",
      startFilesIndexed: 10,
      scanStartedAt: new Date(),
      isResume: true,
      listPage: async ({ pageToken }) => {
        tokens.push(pageToken);
        return {
          items: [],
          nextPageToken: null,
          finalChangesCursor: "cursor-end",
        };
      },
    });
    expect(tokens[0]).toBe("cursor-mid");
  });

  it("restarts once on reset cursor during resume, then fails on second", async () => {
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

    const status = await runDropboxIndexScan({
      userId: "user-1",
      accountId: "dbx-1",
      scanId: "scan-old",
      startPageToken: "bad-cursor",
      startFilesIndexed: 0,
      scanStartedAt: new Date(),
      isResume: true,
      listPage: async () => {
        throw new Error('{"error":{".tag":"reset"}}');
      },
    });
    expect(status.indexStatus).toBe("failed");
  });

  it("pauses (not fails) when rate limited", async () => {
    prismaMock.connectedAccount.findUniqueOrThrow.mockResolvedValue({
      ...accountBase,
      indexStatus: "paused",
      indexScanId: "scan-dbx",
      indexPageToken: "cursor-mid",
    });
    const status = await runDropboxIndexScan({
      userId: "user-1",
      accountId: "dbx-1",
      scanId: "scan-dbx",
      startPageToken: "cursor-mid",
      startFilesIndexed: 4,
      scanStartedAt: new Date(),
      isResume: true,
      listPage: async () => {
        throw new IndexRateLimitedError(
          "Dropbox too_many_requests after 6 retries.",
        );
      },
    });
    expect(status.indexStatus).toBe("paused");
    expect(prismaMock.connectedAccount.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ indexStatus: "paused" }),
      }),
    );
  });
});

describe("runDropboxIncrementalSync", () => {
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
    prismaMock.file.findUnique.mockResolvedValue(null);
  });

  it("is a no-op when indexing flag is off", async () => {
    envState.WHOLE_ACCOUNT_INDEXING_ENABLED = false;
    expect(
      await runDropboxIncrementalSync({ accountId: "dbx-1" }),
    ).toMatchObject({ status: "disabled" });
  });

  it("skips app-folder accounts", async () => {
    prismaMock.connectedAccount.findFirst.mockResolvedValue({
      ...accountBase,
      dropboxNeedsFullAccess: true,
    });
    expect(
      await runDropboxIncrementalSync({ accountId: "dbx-1" }),
    ).toMatchObject({ status: "skipped", reason: "dropbox_app_folder" });
  });

  it("flags needs_full_scan on reset cursor", async () => {
    const result = await runDropboxIncrementalSync({
      accountId: "dbx-1",
      listChangesPage: async () => {
        throw new Error("error.tag reset");
      },
    });
    expect(result.status).toBe("needs_full_scan");
    expect(prismaMock.connectedAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ indexNeedsFullScan: true }),
      }),
    );
  });

  it("applies folder move/rename upsert and path-prefix deletion", async () => {
    const page = {
      ops: [
        { type: "remove_path_prefix" as const, pathLower: "/old" },
        {
          type: "upsert" as const,
          item: {
            id: "id:folder",
            name: "New",
            mimeType: "application/vnd.archivecloud.folder",
            sizeBytes: null,
            providerParentId: DROPBOX_ROOT_PROVIDER_ID,
            providerPathLower: "/new",
            isFolder: true,
            isShortcut: false,
            shortcutTargetId: null,
          },
        },
      ],
      nextPageToken: null,
      newStartPageToken: "cursor-2",
    };
    await runDropboxIncrementalSync({
      accountId: "dbx-1",
      listChangesPage: async () => page,
    });
    expect(prismaMock.file.findMany).toHaveBeenCalled();
    expect(prismaMock.file.upsert).toHaveBeenCalled();
  });

  it("is idempotent for duplicate delivery", async () => {
    const page = {
      ops: [
        {
          type: "upsert" as const,
          item: {
            id: "id:f1",
            name: "A",
            mimeType: "text/plain",
            sizeBytes: 1n,
            providerParentId: DROPBOX_ROOT_PROVIDER_ID,
            providerPathLower: "/a",
            isFolder: false,
            isShortcut: false,
            shortcutTargetId: null,
          },
        },
      ],
      nextPageToken: null,
      newStartPageToken: "cursor-dup",
    };
    await runDropboxIncrementalSync({
      accountId: "dbx-1",
      listChangesPage: async () => page,
    });
    await runDropboxIncrementalSync({
      accountId: "dbx-1",
      listChangesPage: async () => page,
    });
    expect(prismaMock.file.upsert).toHaveBeenCalledTimes(2);
  });
});
