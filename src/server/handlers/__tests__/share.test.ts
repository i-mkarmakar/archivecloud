import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  asRoute,
  authed,
  jsonRequest,
  prismaMock,
  readJson,
  unauthenticated,
} from "./handler-test-utils";

vi.mock("@/server/utils/crypto", () => ({
  randomToken: () => "share-token-abc",
  hashToken: (token: string) => `hash:${token}`,
  encryptText: (token: string) => `enc:${token}`,
  decryptText: (value: string) =>
    value.startsWith("enc:") ? value.slice(4) : value,
}));

const makeGoogleDriveFilePublicReader = vi.fn();

vi.mock("@/server/modules/providers/google/google.service", () => ({
  googleDriveOAuthScopes: ["https://www.googleapis.com/auth/drive"],
  makeGoogleDriveFilePublicReader: (...args: unknown[]) =>
    makeGoogleDriveFilePublicReader(...args),
  getGoogleDriveWebLinks: vi.fn(),
  syncGoogleAppFolderFiles: vi.fn(),
  syncGoogleQuota: vi.fn(),
}));

vi.mock("@/server/modules/providers/operations", () => ({
  renameProviderFile: vi.fn(),
  deleteProviderFile: vi.fn(),
  getProviderFileMeta: vi.fn(),
}));

vi.mock("@/server/modules/files/stream-file", () => ({
  streamProviderFileResponse: vi.fn(),
}));

vi.mock("@/server/modules/files/stream-google-file", () => ({
  fetchGoogleDriveFileMedia: vi.fn(),
  streamGoogleDriveThumbnailResponse: vi.fn(),
}));

import {
  publicPermissionHandler,
  shareFileHandler,
} from "@/server/handlers/files";

const share = asRoute(shareFileHandler);
const publicPerm = asRoute(publicPermissionHandler);

const activeFile = {
  id: "file-1",
  userId: "user-1",
  name: "notes.txt",
  status: "active",
  deletedAt: null,
  provider: "google_drive",
  providerFileId: "g-1",
  connectedAccountId: "acct-1",
  connectedAccount: { id: "acct-1", provider: "google_drive" },
};

describe("shareFileHandler", () => {
  beforeEach(() => {
    authed();
  });

  it("happy path: creates a public share link", async () => {
    prismaMock.file.findFirst.mockResolvedValue(activeFile);
    prismaMock.fileShare.findFirst.mockResolvedValue(null);
    prismaMock.fileShare.create.mockResolvedValue({
      id: "share-1",
      enabled: true,
    });

    const response = await share(
      jsonRequest("http://localhost/files/file-1/share", {}),
      { params: Promise.resolve({ id: "file-1" }) },
    );
    const body = await readJson(response);

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      shareId: "share-1",
      fileId: "file-1",
      enabled: true,
      status: "active",
      url: "http://localhost:9050/public/files/share-token-abc",
    });
  });

  it("returns 401 when unauthenticated", async () => {
    unauthenticated();
    const response = await share(
      jsonRequest("http://localhost/files/file-1/share", {}),
      { params: Promise.resolve({ id: "file-1" }) },
    );
    const body = await readJson(response);
    expect(response.status).toBe(401);
    expect(body.code).toBe("AUTH_REQUIRED");
  });

  it("returns VALIDATION_ERROR for invalid Zod input", async () => {
    const response = await share(
      jsonRequest("http://localhost/files/file-1/share", {
        name: "",
      }),
      { params: Promise.resolve({ id: "file-1" }) },
    );
    const body = await readJson(response);
    expect(response.status).toBe(400);
    expect(body.code).toBe("VALIDATION_ERROR");
  });
});

describe("publicPermissionHandler (provider error)", () => {
  beforeEach(() => {
    authed();
  });

  it("returns GOOGLE_API_ERROR when the provider call fails", async () => {
    prismaMock.file.findFirstOrThrow.mockResolvedValue(activeFile);
    makeGoogleDriveFilePublicReader.mockRejectedValue(
      new Error("Drive permission denied"),
    );

    const response = await publicPerm(
      jsonRequest("http://localhost/files/file-1/public", {}),
      { params: Promise.resolve({ id: "file-1" }) },
    );
    const body = await readJson(response);

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      code: "GOOGLE_API_ERROR",
      message: "Drive permission denied",
    });
  });
});
