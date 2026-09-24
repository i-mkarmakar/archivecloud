import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  asRoute,
  authed,
  jsonRequest,
  prismaMock,
  readJson,
  unauthenticated,
} from "./handler-test-utils";

const renameProviderFile = vi.fn();
const deleteProviderFile = vi.fn();

vi.mock("@/server/modules/providers/operations", () => ({
  renameProviderFile: (...args: unknown[]) => renameProviderFile(...args),
  deleteProviderFile: (...args: unknown[]) => deleteProviderFile(...args),
}));

vi.mock("@/server/modules/providers/google/google.service", () => ({
  makeGoogleDriveFilePublicReader: vi.fn(),
  getGoogleDriveWebLinks: vi.fn(),
  syncGoogleAppFolderFiles: vi.fn(),
  syncGoogleQuota: vi.fn(),
}));

vi.mock("@/server/modules/files/stream-file", () => ({
  streamProviderFileResponse: vi.fn(),
}));

vi.mock("@/server/modules/files/stream-google-file", () => ({
  fetchGoogleDriveFileMedia: vi.fn(),
  streamGoogleDriveThumbnailResponse: vi.fn(),
}));

import { listFilesHandler, updateFileHandler } from "@/server/handlers/files";

const listFiles = asRoute(listFilesHandler);
const updateFile = asRoute(updateFileHandler);

const now = new Date("2026-01-15T12:00:00.000Z");
const fileRow = {
  id: "file-1",
  userId: "user-1",
  connectedAccountId: "acct-1",
  folderId: null,
  provider: "google_drive",
  providerFileId: "g-1",
  name: "photo.jpg",
  mimeType: "image/jpeg",
  sizeBytes: 2048n,
  checksum: null,
  status: "active",
  isStarred: false,
  starredAt: null,
  isArchived: false,
  archivedAt: null,
  lastAccessedAt: null,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  connectedAccount: {
    id: "acct-1",
    email: "me@example.com",
    provider: "google_drive",
    displayName: "Me",
    avatarUrl: null,
  },
  folder: null,
  fileTags: [],
};

describe("listFilesHandler", () => {
  beforeEach(() => {
    authed();
  });

  it("happy path: returns serialized files", async () => {
    prismaMock.file.findMany.mockResolvedValue([fileRow]);

    const response = await listFiles(
      new Request("http://localhost/files?limit=10"),
    );
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.files).toHaveLength(1);
    expect((body.files as Array<Record<string, unknown>>)[0]).toMatchObject({
      id: "file-1",
      name: "photo.jpg",
      sizeBytes: "2048",
    });
    expect(body.nextCursor).toBeNull();
  });

  it("returns 401 when unauthenticated", async () => {
    unauthenticated();
    const response = await listFiles(new Request("http://localhost/files"));
    const body = await readJson(response);
    expect(response.status).toBe(401);
    expect(body.code).toBe("AUTH_REQUIRED");
  });

  it("returns VALIDATION_ERROR for invalid Zod query input", async () => {
    const response = await listFiles(
      new Request("http://localhost/files?kind=not-a-kind"),
    );
    const body = await readJson(response);
    expect(response.status).toBe(400);
    expect(body.code).toBe("VALIDATION_ERROR");
  });
});

describe("updateFileHandler", () => {
  beforeEach(() => {
    authed();
  });

  it("happy path: renames via provider facade then updates DB", async () => {
    prismaMock.file.findFirstOrThrow.mockResolvedValue({
      ...fileRow,
      connectedAccount: fileRow.connectedAccount,
    });
    renameProviderFile.mockResolvedValue(undefined);
    prismaMock.file.update.mockResolvedValue({
      ...fileRow,
      name: "renamed.jpg",
    });

    const response = await updateFile(
      jsonRequest(
        "http://localhost/files/file-1",
        { name: "renamed.jpg" },
        {
          method: "PATCH",
        },
      ),
      { params: Promise.resolve({ id: "file-1" }) },
    );
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.file).toMatchObject({ id: "file-1", name: "renamed.jpg" });
    expect(renameProviderFile).toHaveBeenCalledWith({
      account: fileRow.connectedAccount,
      providerFileId: "g-1",
      newName: "renamed.jpg",
    });
  });

  it("returns provider error when renameProviderFile fails", async () => {
    prismaMock.file.findFirstOrThrow.mockResolvedValue({
      ...fileRow,
      connectedAccount: fileRow.connectedAccount,
    });
    renameProviderFile.mockRejectedValue(new Error("provider rename failed"));

    const response = await updateFile(
      jsonRequest(
        "http://localhost/files/file-1",
        { name: "renamed.jpg" },
        {
          method: "PATCH",
        },
      ),
      { params: Promise.resolve({ id: "file-1" }) },
    );
    const body = await readJson(response);

    // Characterization: uncaught provider error becomes INTERNAL_SERVER_ERROR.
    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "provider rename failed",
    });
  });

  it("returns VALIDATION_ERROR for invalid Zod input", async () => {
    const response = await updateFile(
      jsonRequest(
        "http://localhost/files/file-1",
        { name: "" },
        {
          method: "PATCH",
        },
      ),
      { params: Promise.resolve({ id: "file-1" }) },
    );
    const body = await readJson(response);
    expect(response.status).toBe(400);
    expect(body.code).toBe("VALIDATION_ERROR");
  });
});
