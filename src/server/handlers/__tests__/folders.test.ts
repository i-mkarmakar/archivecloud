import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  asRoute,
  authed,
  jsonRequest,
  prismaMock,
  readJson,
  unauthenticated,
} from "./handler-test-utils";

const ensureGoogleAppFolder = vi.fn();
const createGoogleDriveFolder = vi.fn();
const syncGoogleQuota = vi.fn();
const renameProviderFile = vi.fn();
const moveProviderItem = vi.fn();
const deleteProviderFile = vi.fn();

vi.mock("@/server/modules/providers/google/google.service", () => ({
  ensureGoogleAppFolder: (...args: unknown[]) => ensureGoogleAppFolder(...args),
  createGoogleDriveFolder: (...args: unknown[]) =>
    createGoogleDriveFolder(...args),
  syncGoogleQuota: (...args: unknown[]) => syncGoogleQuota(...args),
}));

vi.mock("@/server/modules/providers/operations", () => ({
  renameProviderFile: (...args: unknown[]) => renameProviderFile(...args),
  moveProviderItem: (...args: unknown[]) => moveProviderItem(...args),
  deleteProviderFile: (...args: unknown[]) => deleteProviderFile(...args),
}));

import {
  createFolderHandler,
  listFoldersHandler,
} from "@/server/handlers/folders";

const listFolders = asRoute(listFoldersHandler);
const createFolder = asRoute(createFolderHandler);

const now = new Date("2026-01-15T12:00:00.000Z");
const folderRow = {
  id: "folder-1",
  name: "Projects",
  color: "#1e9df1",
  parentId: null,
  providerFolderId: "g-folder-1",
  createdAt: now,
  updatedAt: now,
};

describe("listFoldersHandler", () => {
  beforeEach(() => {
    authed();
  });

  it("happy path: returns folders", async () => {
    prismaMock.folder.findMany.mockResolvedValue([folderRow]);
    prismaMock.connectedAccount.findFirst.mockResolvedValue(null);

    const response = await listFolders(new Request("http://localhost/folders"));
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.folders).toEqual([
      {
        ...folderRow,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    ]);
  });

  it("returns 401 when unauthenticated", async () => {
    unauthenticated();
    const response = await listFolders(new Request("http://localhost/folders"));
    const body = await readJson(response);
    expect(response.status).toBe(401);
    expect(body.code).toBe("AUTH_REQUIRED");
  });
});

describe("createFolderHandler", () => {
  beforeEach(() => {
    authed();
  });

  it("happy path: creates DB folder and provider folder", async () => {
    const account = {
      id: "acct-1",
      userId: "user-1",
      provider: "google_drive",
      status: "connected",
    };
    prismaMock.connectedAccount.findFirst.mockResolvedValue(account);
    ensureGoogleAppFolder.mockResolvedValue("app-folder");
    createGoogleDriveFolder.mockResolvedValue("g-folder-new");
    prismaMock.folder.create.mockResolvedValue({
      ...folderRow,
      id: "folder-new",
      name: "New",
      providerFolderId: "g-folder-new",
    });

    const response = await createFolder(
      jsonRequest("http://localhost/folders", { name: "New" }),
    );
    const body = await readJson(response);

    expect(response.status).toBe(201);
    expect(body.folder).toMatchObject({
      id: "folder-new",
      name: "New",
      providerFolderId: "g-folder-new",
    });
    expect(createGoogleDriveFolder).toHaveBeenCalled();
  });

  it("returns VALIDATION_ERROR for invalid Zod input", async () => {
    const response = await createFolder(
      jsonRequest("http://localhost/folders", { name: "" }),
    );
    const body = await readJson(response);
    expect(response.status).toBe(400);
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("still creates the DB folder when provider create fails", async () => {
    const account = {
      id: "acct-1",
      userId: "user-1",
      provider: "google_drive",
      status: "connected",
    };
    prismaMock.connectedAccount.findFirst.mockResolvedValue(account);
    ensureGoogleAppFolder.mockResolvedValue("app-folder");
    createGoogleDriveFolder.mockRejectedValue(new Error("Drive API down"));
    prismaMock.folder.create.mockResolvedValue({
      ...folderRow,
      id: "folder-local",
      name: "LocalOnly",
      providerFolderId: null,
    });

    const response = await createFolder(
      jsonRequest("http://localhost/folders", { name: "LocalOnly" }),
    );
    const body = await readJson(response);

    // Characterization: provider errors are logged and swallowed; DB create continues.
    expect(response.status).toBe(201);
    expect(body.folder).toMatchObject({
      id: "folder-local",
      name: "LocalOnly",
      providerFolderId: null,
    });
  });

  // Quota exceeded: createFolderHandler does not enforce storage quota today.
  // Covered for transfers/uploads instead.
});
