import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const envState = vi.hoisted(() => ({
  WHOLE_ACCOUNT_INDEXING_ENABLED: true,
  TOKEN_ENCRYPTION_KEY: "test-token-encryption-key-32b!!!!",
}));

vi.mock("@/server/config/env", () => ({
  env: envState,
}));

const prismaMock = vi.hoisted(() => ({
  providerWebhookChannel: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/server/config/prisma", () => ({
  prisma: prismaMock,
}));

const folderSync = vi.hoisted(() => vi.fn());
vi.mock("@/server/modules/webhooks/trigger-account-syncs", () => ({
  scheduleFolderSyncsForAccount: folderSync,
}));

vi.mock("@/server/modules/indexing/google-drive-incremental", () => ({
  runGoogleDriveIncrementalSync: vi.fn(async () => ({
    status: "ok",
    applied: 0,
  })),
}));

vi.mock("@/server/modules/indexing/onedrive-index", () => ({
  runOneDriveIncrementalSync: vi.fn(async () => ({
    status: "ok",
    applied: 0,
  })),
}));

vi.mock("@/server/modules/indexing/dropbox-index", () => ({
  runDropboxIncrementalSync: vi.fn(async () => ({
    status: "ok",
    applied: 0,
  })),
}));

vi.mock("@/server/modules/onedrive/onedrive.service", () => ({
  getOneDriveAccessToken: vi.fn(),
}));

import { googleDriveWebhookHandler } from "@/server/handlers/webhooks-google";
import {
  CATALOG_SYNC_DEBOUNCE_MS,
  clearCatalogSyncSchedulesForTests,
  scheduleCatalogIncrementalSync,
  setCatalogSyncRunnerForTests,
} from "@/server/modules/indexing/trigger-catalog-sync";

const channel = {
  id: "ch-1",
  connectedAccountId: "acct-1",
  channelId: "google-channel-1",
  channelToken: "secret-token",
  resourceId: "res-1",
  status: "active",
};

function driveRequest(headers: Record<string, string>) {
  return new Request("http://localhost/webhooks/google-drive", {
    method: "POST",
    headers,
  });
}

describe("googleDriveWebhookHandler catalog path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    clearCatalogSyncSchedulesForTests();
    envState.WHOLE_ACCOUNT_INDEXING_ENABLED = true;
    prismaMock.providerWebhookChannel.findUnique.mockResolvedValue(channel);
    prismaMock.providerWebhookChannel.findFirst.mockResolvedValue(null);
    prismaMock.providerWebhookChannel.update.mockResolvedValue(channel);
  });

  afterEach(() => {
    clearCatalogSyncSchedulesForTests();
    setCatalogSyncRunnerForTests(null);
    vi.useRealTimers();
  });

  it("validates channel id/token like FolderSync (fail closed)", async () => {
    const missing = await googleDriveWebhookHandler(
      driveRequest({ "x-goog-channel-id": "google-channel-1" }),
    );
    expect(missing.status).toBe(403);
    expect(folderSync).not.toHaveBeenCalled();

    const bad = await googleDriveWebhookHandler(
      driveRequest({
        "x-goog-channel-id": "google-channel-1",
        "x-goog-channel-token": "wrong",
        "x-goog-resource-id": "res-1",
      }),
    );
    expect(bad.status).toBe(403);

    const runner = vi.fn(async () => ({ status: "ok", applied: 0 }));
    setCatalogSyncRunnerForTests(runner);

    const ok = await googleDriveWebhookHandler(
      driveRequest({
        "x-goog-channel-id": "google-channel-1",
        "x-goog-channel-token": "secret-token",
        "x-goog-resource-id": "res-1",
        "x-goog-resource-state": "change",
      }),
    );
    expect(ok.status).toBe(200);
    expect(folderSync).toHaveBeenCalledWith("acct-1", expect.any(String));

    await vi.advanceTimersByTimeAsync(CATALOG_SYNC_DEBOUNCE_MS);
    expect(runner).toHaveBeenCalledWith("acct-1");
  });

  it("trailing debounce: burst then quiet → exactly one sync", async () => {
    const runner = vi.fn(async () => ({ status: "ok", applied: 0 }));
    setCatalogSyncRunnerForTests(runner);

    scheduleCatalogIncrementalSync("acct-1", "n1");
    scheduleCatalogIncrementalSync("acct-1", "n2");
    scheduleCatalogIncrementalSync("acct-1", "n3");

    expect(runner).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(CATALOG_SYNC_DEBOUNCE_MS - 1);
    expect(runner).not.toHaveBeenCalled();
    scheduleCatalogIncrementalSync("acct-1", "n4");
    await vi.advanceTimersByTimeAsync(CATALOG_SYNC_DEBOUNCE_MS - 1);
    expect(runner).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner).toHaveBeenCalledWith("acct-1");
  });
});
