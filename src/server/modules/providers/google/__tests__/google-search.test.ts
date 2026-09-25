import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const filesList = vi.fn();
const getAuthedGoogleClient = vi.fn();

vi.mock("googleapis", () => ({
  google: {
    drive: vi.fn(() => ({
      files: { list: filesList },
    })),
  },
}));

vi.mock("@/server/modules/providers/google/google.service", () => ({
  getAuthedGoogleClient: (...args: unknown[]) => getAuthedGoogleClient(...args),
}));

vi.mock("@/server/config/prisma", () => ({
  prisma: {},
}));

vi.mock("@/server/modules/dropbox/dropbox.service", () => ({
  getDropboxAccessToken: vi.fn(),
}));

vi.mock("@/server/modules/onedrive/onedrive.service", () => ({
  getOneDriveAccessToken: vi.fn(),
}));

vi.mock("@/server/modules/pcloud/pcloud.service", () => ({
  getPCloudAccessToken: vi.fn(),
  getPCloudApiBaseForAccount: vi.fn(),
}));

vi.mock("@/server/modules/providers/operations", () => ({
  browseProviderFolder: vi.fn(),
}));

import { searchConnectedAccount } from "@/server/modules/search/cross-cloud-search";

const driveAccount = {
  id: "acct-drive",
  userId: "user-1",
  provider: "google_drive",
  email: "drive@example.com",
  displayName: "My Drive",
  providerAccountId: "user-drive-id",
  status: "connected",
} as const;

const sharedDriveAccount = {
  id: "acct-shared",
  userId: "user-1",
  provider: "google_shared_drive",
  email: "shared@example.com",
  displayName: "Team Drive",
  providerAccountId: "shared-drive-abc",
  status: "connected",
} as const;

describe("Google Drive search queries (characterization)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthedGoogleClient.mockResolvedValue({ kind: "auth" });
  });

  it("My Drive: passes exact files.list params and shapes hits", async () => {
    filesList.mockResolvedValue({
      data: {
        files: [
          {
            id: "folder-1",
            name: "Reports",
            mimeType: "application/vnd.google-apps.folder",
            modifiedTime: "2026-01-01T00:00:00.000Z",
          },
          {
            id: "file-1",
            name: "report.pdf",
            mimeType: "application/pdf",
            size: "2048",
            modifiedTime: "2026-01-02T00:00:00.000Z",
          },
          {
            id: "file-2",
            name: "sheet",
            mimeType: "application/vnd.google-apps.spreadsheet",
            quotaBytesUsed: "99",
            modifiedTime: "2026-01-03T00:00:00.000Z",
          },
          {
            // skipped: missing name
            id: "orphan",
          },
        ],
      },
    });

    const result = await searchConnectedAccount(
      driveAccount as never,
      "user-1",
      "report",
      50,
    );

    expect(getAuthedGoogleClient).toHaveBeenCalledWith(driveAccount);
    expect(filesList).toHaveBeenCalledTimes(1);
    expect(filesList).toHaveBeenCalledWith({
      q: "trashed = false and name contains 'report'",
      spaces: "drive",
      fields:
        "files(id,name,mimeType,size,modifiedTime,quotaBytesUsed,parents)",
      pageSize: 50,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      orderBy: "modifiedTime desc",
    });

    expect(result).toMatchObject({
      accountId: "acct-drive",
      provider: "google_drive",
      email: "drive@example.com",
      displayName: "My Drive",
    });
    expect(result.folders).toEqual([
      {
        id: "folder-1",
        name: "Reports",
        kind: "folder",
        modifiedTime: "2026-01-01T00:00:00.000Z",
      },
    ]);
    expect(result.files).toEqual([
      {
        id: "file-1",
        name: "report.pdf",
        kind: "file",
        mimeType: "application/pdf",
        sizeBytes: "2048",
        modifiedTime: "2026-01-02T00:00:00.000Z",
      },
      {
        id: "file-2",
        name: "sheet",
        kind: "file",
        mimeType: "application/vnd.google-apps.spreadsheet",
        sizeBytes: "99",
        modifiedTime: "2026-01-03T00:00:00.000Z",
      },
    ]);
  });

  it("My Drive: escapes quotes/backslashes in the Drive q string", async () => {
    filesList.mockResolvedValue({ data: { files: [] } });

    await searchConnectedAccount(
      driveAccount as never,
      "user-1",
      "O'Brien\\Draft",
      10,
    );

    expect(filesList.mock.calls[0][0].q).toBe(
      "trashed = false and name contains 'O\\'Brien\\\\Draft'",
    );
  });

  it("My Drive: caps pageSize at 100", async () => {
    filesList.mockResolvedValue({ data: { files: [] } });
    await searchConnectedAccount(driveAccount as never, "user-1", "x", 500);
    expect(filesList.mock.calls[0][0].pageSize).toBe(100);
  });

  it("Shared Drive: passes corpora/driveId params and shapes hits", async () => {
    filesList.mockResolvedValue({
      data: {
        files: [
          {
            id: "sd-folder",
            name: "Shared Docs",
            mimeType: "application/vnd.google-apps.folder",
            modifiedTime: "2026-02-01T00:00:00.000Z",
          },
          {
            id: "sd-file",
            name: "notes.txt",
            mimeType: "text/plain",
            size: "12",
            modifiedTime: "2026-02-02T00:00:00.000Z",
          },
        ],
      },
    });

    const result = await searchConnectedAccount(
      sharedDriveAccount as never,
      "user-1",
      "notes",
      25,
    );

    expect(filesList).toHaveBeenCalledWith({
      q: "trashed = false and name contains 'notes'",
      corpora: "drive",
      driveId: "shared-drive-abc",
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      fields: "files(id,name,mimeType,size,modifiedTime,quotaBytesUsed)",
      pageSize: 25,
      orderBy: "modifiedTime desc",
    });

    expect(result.folders).toEqual([
      {
        id: "sd-folder",
        name: "Shared Docs",
        kind: "folder",
        modifiedTime: "2026-02-01T00:00:00.000Z",
      },
    ]);
    expect(result.files).toEqual([
      {
        id: "sd-file",
        name: "notes.txt",
        kind: "file",
        mimeType: "text/plain",
        sizeBytes: "12",
        modifiedTime: "2026-02-02T00:00:00.000Z",
      },
    ]);
  });
});
