import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const envState = vi.hoisted(() => ({
  WHOLE_ACCOUNT_INDEXING_ENABLED: true,
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
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  file: {
    upsert: vi.fn(),
    updateMany: vi.fn(),
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
  accountNeedsReconnect: vi.fn(() => ({
    needsReconnect: false,
    reason: null,
  })),
}));

vi.mock("@/server/modules/providers/google/google.service", () => ({
  getAuthedGoogleClient: vi.fn(),
}));

vi.mock("@/server/modules/providers/google/google-drive-list", () => ({
  listOwnedGoogleDriveFilesPage: vi.fn(),
}));

vi.mock("@/server/modules/providers/google/google-drive-changes", () => ({
  listGoogleDriveChangesPage: vi.fn(),
  isInvalidGoogleChangesTokenError: (error: unknown) =>
    /invalid.*token/i.test(
      error instanceof Error ? error.message : String(error),
    ),
  isInvalidGoogleListPageTokenError: vi.fn(),
  isGoogleAuthError: (error: unknown) =>
    /invalid_grant|tokens are missing/i.test(
      error instanceof Error ? error.message : String(error),
    ),
  getGoogleDriveChangesStartPageToken: vi.fn(),
}));

import {
  applyGoogleDriveChange,
  runGoogleDriveIncrementalSync,
} from "@/server/modules/indexing/google-drive-incremental";
import { accountNeedsReconnect } from "@/server/modules/providers/scopes";

const account = {
  id: "acct-1",
  userId: "user-1",
  provider: "google_drive",
  status: "connected",
  scopes: [],
  indexStatus: "complete",
  indexHeartbeatAt: null as Date | null,
  indexChangesPageToken: "tok-1",
  indexNeedsFullScan: false,
};

describe("applyGoogleDriveChange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.file.findMany.mockResolvedValue([{ id: "row-1" }]);
    prismaMock.file.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.file.upsert.mockResolvedValue({});
    prismaMock.fileShare.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.filePreviewToken.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.workspaceInvite.updateMany.mockResolvedValue({ count: 1 });
  });

  it("soft-deletes removed files and revokes shares/previews/invites", async () => {
    await applyGoogleDriveChange({
      userId: "user-1",
      connectedAccountId: "acct-1",
      change: { fileId: "f1", removed: true },
    });
    expect(prismaMock.fileShare.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { enabled: false } }),
    );
    expect(prismaMock.filePreviewToken.deleteMany).toHaveBeenCalled();
    expect(prismaMock.workspaceInvite.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { revokedAt: expect.any(Date), status: "revoked" },
      }),
    );
  });

  it("keeps old share disabled after restore (explicit re-share required)", async () => {
    await applyGoogleDriveChange({
      userId: "user-1",
      connectedAccountId: "acct-1",
      change: { fileId: "f1", removed: true },
    });
    prismaMock.file.upsert.mockClear();
    await applyGoogleDriveChange({
      userId: "user-1",
      connectedAccountId: "acct-1",
      change: {
        fileId: "f1",
        removed: false,
        file: {
          id: "f1",
          name: "Back",
          mimeType: "text/plain",
          owners: [{ me: true }],
        },
      },
    });
    expect(prismaMock.file.upsert).toHaveBeenCalled();
    expect(prismaMock.fileShare.updateMany).toHaveBeenCalledTimes(1);
  });

  it("ignores non-owned files", async () => {
    const result = await applyGoogleDriveChange({
      userId: "user-1",
      connectedAccountId: "acct-1",
      change: {
        fileId: "shared",
        removed: false,
        file: {
          id: "shared",
          name: "Shared",
          mimeType: "text/plain",
          owners: [{ me: false }],
        },
      },
    });
    expect(result).toBe("ignored");
    expect(prismaMock.file.upsert).not.toHaveBeenCalled();
  });

  it("upserts rename/move/shortcut metadata", async () => {
    await applyGoogleDriveChange({
      userId: "user-1",
      connectedAccountId: "acct-1",
      change: {
        fileId: "f3",
        removed: false,
        file: {
          id: "f3",
          name: "Renamed",
          mimeType: "application/vnd.google-apps.shortcut",
          parents: ["new-parent"],
          owners: [{ me: true }],
          shortcutDetails: { targetId: "tgt" },
        },
      },
    });
    expect(prismaMock.file.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          name: "Renamed",
          providerParentId: "new-parent",
          isShortcut: true,
        }),
      }),
    );
  });
});

describe("runGoogleDriveIncrementalSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envState.WHOLE_ACCOUNT_INDEXING_ENABLED = true;
    vi.mocked(accountNeedsReconnect).mockReturnValue({
      needsReconnect: false,
      reason: null,
    });
    prismaMock.connectedAccount.findFirst.mockResolvedValue({ ...account });
    prismaMock.connectedAccount.update.mockResolvedValue({});
    prismaMock.connectedAccount.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.file.upsert.mockResolvedValue({});
    prismaMock.file.findMany.mockResolvedValue([{ id: "row-1" }]);
    prismaMock.file.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.fileShare.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.filePreviewToken.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.workspaceInvite.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock),
    );
  });

  it("skips while a full scan lock is fresh", async () => {
    prismaMock.connectedAccount.findFirst.mockResolvedValue({
      ...account,
      indexStatus: "running",
      indexHeartbeatAt: new Date(),
    });
    const result = await runGoogleDriveIncrementalSync({ accountId: "acct-1" });
    expect(result).toMatchObject({
      status: "skipped",
      reason: "full_scan_running",
    });
  });

  it("skips needsReconnect and auth_error accounts", async () => {
    prismaMock.connectedAccount.findFirst.mockResolvedValue(null);
    expect(
      await runGoogleDriveIncrementalSync({ accountId: "gone" }),
    ).toMatchObject({ status: "failed", reason: "account_not_found" });

    prismaMock.connectedAccount.findFirst.mockResolvedValue({ ...account });
    vi.mocked(accountNeedsReconnect).mockReturnValue({
      needsReconnect: true,
      reason: "scopes",
    });
    expect(
      await runGoogleDriveIncrementalSync({ accountId: "acct-1" }),
    ).toMatchObject({ status: "skipped", reason: "needs_reconnect" });

    vi.mocked(accountNeedsReconnect).mockReturnValue({
      needsReconnect: false,
      reason: null,
    });
    prismaMock.connectedAccount.findFirst.mockResolvedValue({
      ...account,
      indexStatus: "auth_error",
    });
    expect(
      await runGoogleDriveIncrementalSync({ accountId: "acct-1" }),
    ).toMatchObject({ status: "skipped", reason: "auth_error" });
  });

  it("stops on auth errors with visible auth_error state", async () => {
    const result = await runGoogleDriveIncrementalSync({
      accountId: "acct-1",
      listChangesPage: async () => {
        throw new Error("invalid_grant");
      },
    });
    expect(result).toMatchObject({ status: "failed", reason: "auth_error" });
    expect(prismaMock.connectedAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ indexStatus: "auth_error" }),
      }),
    );
  });

  it("is idempotent for duplicate deliveries", async () => {
    const page = {
      changes: [
        {
          fileId: "f1",
          removed: false,
          file: {
            id: "f1",
            name: "A",
            mimeType: "text/plain",
            owners: [{ me: true }],
            parents: ["p"],
          },
        },
      ],
      nextPageToken: null,
      newStartPageToken: "tok-2",
    };
    const result1 = await runGoogleDriveIncrementalSync({
      accountId: "acct-1",
      listChangesPage: async () => page,
    });
    const result2 = await runGoogleDriveIncrementalSync({
      accountId: "acct-1",
      listChangesPage: async () => page,
    });
    expect(result1.status).toBe("ok");
    expect(result2.status).toBe("ok");
    expect(prismaMock.file.upsert).toHaveBeenCalledTimes(2);
  });

  it("flags needs_full_scan when the changes token is invalid", async () => {
    const result = await runGoogleDriveIncrementalSync({
      accountId: "acct-1",
      listChangesPage: async () => {
        throw new Error("Invalid Value: pageToken is invalid");
      },
    });
    expect(result.status).toBe("needs_full_scan");
  });

  it("saves the page token only after the batch is applied (crash replay)", async () => {
    const order: string[] = [];
    prismaMock.file.upsert.mockImplementation(async () => {
      order.push("upsert");
      return {};
    });
    prismaMock.connectedAccount.updateMany.mockImplementation(async () => {
      order.push("token");
      return { count: 1 };
    });

    await runGoogleDriveIncrementalSync({
      accountId: "acct-1",
      listChangesPage: async () => ({
        changes: [
          {
            fileId: "f1",
            removed: false,
            file: {
              id: "f1",
              name: "A",
              mimeType: "text/plain",
              owners: [{ me: true }],
            },
          },
        ],
        nextPageToken: null,
        newStartPageToken: "tok-next",
      }),
    });

    expect(order.indexOf("upsert")).toBeLessThan(order.indexOf("token"));
  });
});
