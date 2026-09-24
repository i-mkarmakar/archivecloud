import type { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  asRoute,
  authed,
  jsonRequest,
  prismaMock,
  readJson,
  unauthenticated,
} from "./handler-test-utils";

const {
  uploadGoogleDriveMediaFile,
  initGoogleDriveResumableUpload,
  queryGoogleDriveResumableStatus,
  putGoogleDriveResumableChunk,
  ensureGoogleAppFolder,
  syncGoogleQuota,
} = vi.hoisted(() => ({
  uploadGoogleDriveMediaFile: vi.fn(),
  initGoogleDriveResumableUpload: vi.fn(),
  queryGoogleDriveResumableStatus: vi.fn(),
  putGoogleDriveResumableChunk: vi.fn(),
  ensureGoogleAppFolder: vi.fn(),
  syncGoogleQuota: vi.fn(),
}));

vi.mock("@/server/modules/providers/google-drive-upload", () => ({
  uploadGoogleDriveMediaFile,
  initGoogleDriveResumableUpload,
  queryGoogleDriveResumableStatus,
  putGoogleDriveResumableChunk,
}));

vi.mock("@/server/modules/providers/google/google.service", () => ({
  ensureGoogleAppFolder,
  syncGoogleQuota,
}));

import {
  handleUploadRequest,
  resumableChunkHandler,
  resumableInitHandler,
  resumableStatusHandler,
} from "@/server/handlers/uploads";

type RouteHandler = (
  request: Request,
  user?: unknown,
  params?: Record<string, string>,
) => Promise<Response>;

const resumableInit = asRoute(resumableInitHandler as RouteHandler);
const resumableStatus = asRoute(resumableStatusHandler as RouteHandler);
const resumableChunk = asRoute(resumableChunkHandler as RouteHandler);

const now = new Date();
const eligibleAccount = {
  id: "acct-1",
  userId: "user-1",
  email: "drive@example.com",
  provider: "google_drive",
  status: "connected",
  createdAt: now,
  storageAccount: {
    availableBytes: 50_000_000n,
    lastSyncedAt: now,
  },
};

const fullAccount = {
  ...eligibleAccount,
  storageAccount: {
    availableBytes: 10n,
    lastSyncedAt: now,
  },
};

function mockEligibleAccounts(account = eligibleAccount) {
  prismaMock.connectedAccount.findMany.mockResolvedValue([account]);
  prismaMock.uploadRoutingPolicy.upsert.mockResolvedValue({
    userId: "user-1",
    mode: "most_available",
    priorityAccountIds: [],
    roundRobinCursor: 0,
  });
}

async function drainReadable(body: Readable) {
  await new Promise<void>((resolve, reject) => {
    body.on("end", () => resolve());
    body.on("error", reject);
    body.resume();
  });
}

function buildMultipartRequest(params: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  content: Buffer;
}) {
  const boundary = "----VitestUploadBoundary";
  const parts: Buffer[] = [];
  const pushField = (name: string, value: string) => {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
      ),
    );
  };
  pushField("sizeBytes", String(params.sizeBytes));
  pushField("fileName", params.fileName);
  pushField("mimeType", params.mimeType);
  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file-0"; filename="${params.fileName}"\r\nContent-Type: ${params.mimeType}\r\n\r\n`,
    ),
  );
  parts.push(params.content);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  const body = Buffer.concat(parts);
  return new Request("http://localhost/uploads", {
    method: "POST",
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`,
      "content-length": String(body.length),
    },
    body,
  });
}

describe("handleUploadRequest (media upload)", () => {
  beforeEach(() => {
    authed();
    ensureGoogleAppFolder.mockResolvedValue("app-folder-id");
    syncGoogleQuota.mockResolvedValue(undefined);
    uploadGoogleDriveMediaFile.mockImplementation(
      async (params: {
        body: Readable;
        fileName: string;
        mimeType: string;
      }) => {
        await drainReadable(params.body);
        return {
          id: "g-file-1",
          name: params.fileName,
          mimeType: params.mimeType,
        };
      },
    );
  });

  it("happy path: streams multipart file through the upload seam", async () => {
    mockEligibleAccounts();
    const content = Buffer.from("hello-upload");
    prismaMock.uploadSession.create.mockResolvedValue({ id: "sess-1" });
    prismaMock.uploadSession.update.mockResolvedValue({});
    prismaMock.file.create.mockResolvedValue({
      id: "file-1",
      userId: "user-1",
      connectedAccountId: "acct-1",
      folderId: null,
      provider: "google_drive",
      providerFileId: "g-file-1",
      name: "hello.txt",
      mimeType: "text/plain",
      sizeBytes: BigInt(content.length),
    });

    const response = await handleUploadRequest(
      buildMultipartRequest({
        fileName: "hello.txt",
        mimeType: "text/plain",
        sizeBytes: content.length,
        content,
      }),
    );
    const body = await readJson(response);

    expect(response.status).toBe(201);
    expect(body.file).toMatchObject({
      id: "file-1",
      name: "hello.txt",
      sizeBytes: String(content.length),
    });
    expect(uploadGoogleDriveMediaFile).toHaveBeenCalledTimes(1);
    expect(uploadGoogleDriveMediaFile.mock.calls[0][0]).toMatchObject({
      fileName: "hello.txt",
      mimeType: "text/plain",
      parentId: "app-folder-id",
    });
  });

  it("returns 401 when unauthenticated", async () => {
    unauthenticated();
    const response = await handleUploadRequest(
      buildMultipartRequest({
        fileName: "hello.txt",
        mimeType: "text/plain",
        sizeBytes: 5,
        content: Buffer.from("hello"),
      }),
    );
    const body = await readJson(response);
    expect(response.status).toBe(401);
    expect(body.code).toBe("AUTH_REQUIRED");
  });

  it("returns UPLOAD_INVALID_CONTENT_TYPE for non-multipart input", async () => {
    const response = await handleUploadRequest(
      jsonRequest("http://localhost/uploads", { fileName: "x" }),
    );
    const body = await readJson(response);
    expect(response.status).toBe(400);
    expect(body.code).toBe("UPLOAD_INVALID_CONTENT_TYPE");
  });

  it("returns NO_ACCOUNT_WITH_ENOUGH_SPACE when quota is exceeded", async () => {
    mockEligibleAccounts(fullAccount);
    const content = Buffer.from("too-big-for-quota!!");
    const response = await handleUploadRequest(
      buildMultipartRequest({
        fileName: "big.txt",
        mimeType: "text/plain",
        sizeBytes: content.length,
        content,
      }),
    );
    const body = await readJson(response);
    expect(response.status).toBe(400);
    expect(body.code).toBe("NO_ACCOUNT_WITH_ENOUGH_SPACE");
  });

  it("returns UPLOAD_FAILED when the provider seam errors", async () => {
    mockEligibleAccounts();
    prismaMock.uploadSession.create.mockResolvedValue({ id: "sess-fail" });
    uploadGoogleDriveMediaFile.mockImplementation(
      async (params: { body: Readable }) => {
        await drainReadable(params.body);
        throw new Error("Drive create failed");
      },
    );

    const content = Buffer.from("payload");
    const response = await handleUploadRequest(
      buildMultipartRequest({
        fileName: "fail.txt",
        mimeType: "text/plain",
        sizeBytes: content.length,
        content,
      }),
    );
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      code: "UPLOAD_FAILED",
      message: "Drive create failed",
    });
  });
});

describe("resumableInitHandler", () => {
  beforeEach(() => {
    authed();
    ensureGoogleAppFolder.mockResolvedValue("app-folder-id");
    syncGoogleQuota.mockResolvedValue(undefined);
  });

  it("happy path: creates a resumable session via the seam", async () => {
    mockEligibleAccounts();
    initGoogleDriveResumableUpload.mockResolvedValue(
      "https://upload.example/session",
    );
    prismaMock.uploadSession.create.mockResolvedValue({ id: "sess-r1" });

    const response = await resumableInit(
      jsonRequest("http://localhost/uploads/resumable/init", {
        fileName: "video.mp4",
        mimeType: "video/mp4",
        sizeBytes: "1024",
      }),
    );
    const body = await readJson(response);

    expect(response.status).toBe(201);
    expect(body).toEqual({
      sessionId: "sess-r1",
      provider: "google_drive",
      offset: 0,
    });
    expect(initGoogleDriveResumableUpload).toHaveBeenCalledWith({
      account: eligibleAccount,
      fileName: "video.mp4",
      mimeType: "video/mp4",
      sizeBytes: 1024n,
      parentId: "app-folder-id",
    });
  });

  it("returns 401 when unauthenticated", async () => {
    unauthenticated();
    const response = await resumableInit(
      jsonRequest("http://localhost/uploads/resumable/init", {
        fileName: "video.mp4",
        mimeType: "video/mp4",
        sizeBytes: "1024",
      }),
    );
    const body = await readJson(response);
    expect(response.status).toBe(401);
    expect(body.code).toBe("AUTH_REQUIRED");
  });

  it("returns VALIDATION_ERROR for invalid Zod input", async () => {
    const response = await resumableInit(
      jsonRequest("http://localhost/uploads/resumable/init", {
        fileName: "",
        mimeType: "video/mp4",
        sizeBytes: "1024",
      }),
    );
    const body = await readJson(response);
    expect(response.status).toBe(400);
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("returns NO_ACCOUNT_WITH_ENOUGH_SPACE when quota is exceeded", async () => {
    mockEligibleAccounts(fullAccount);
    const response = await resumableInit(
      jsonRequest("http://localhost/uploads/resumable/init", {
        fileName: "video.mp4",
        mimeType: "video/mp4",
        sizeBytes: "1024",
      }),
    );
    const body = await readJson(response);
    expect(response.status).toBe(400);
    expect(body.code).toBe("NO_ACCOUNT_WITH_ENOUGH_SPACE");
  });

  it("returns UPLOAD_FAILED when provider init fails", async () => {
    mockEligibleAccounts();
    initGoogleDriveResumableUpload.mockRejectedValue(
      new Error("Google API Init Error: boom"),
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const response = await resumableInit(
      jsonRequest("http://localhost/uploads/resumable/init", {
        fileName: "video.mp4",
        mimeType: "video/mp4",
        sizeBytes: "1024",
      }),
    );
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      code: "UPLOAD_FAILED",
      message: "Could not start the upload. Please try again.",
    });
    expect(consoleError).toHaveBeenCalled();
    const logged = consoleError.mock.calls[0]?.[0];
    expect(logged).toBeInstanceOf(Error);
    expect((logged as Error).message).toBe("Google API Init Error: boom");
    consoleError.mockRestore();
  });
});

describe("resumableStatusHandler", () => {
  beforeEach(() => {
    authed();
  });

  it("happy path: returns offset from provider status query", async () => {
    prismaMock.uploadSession.findFirstOrThrow.mockResolvedValue({
      id: "sess-r1",
      userId: "user-1",
      status: "uploading",
      sizeBytes: 1000n,
      googleSessionUri: "https://upload.example/session",
      targetConnectedAccountId: "acct-1",
    });
    prismaMock.connectedAccount.findFirstOrThrow.mockResolvedValue(
      eligibleAccount,
    );
    queryGoogleDriveResumableStatus.mockResolvedValue(
      new Response(null, {
        status: 308,
        headers: { range: "bytes=0-255" },
      }),
    );

    const response = await resumableStatus(
      new Request("http://localhost/uploads/resumable/status/sess-r1"),
      { params: Promise.resolve({ id: "sess-r1" }) },
    );
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "uploading", offset: "256" });
  });

  it("returns status failed when the provider query throws", async () => {
    prismaMock.uploadSession.findFirstOrThrow.mockResolvedValue({
      id: "sess-r1",
      userId: "user-1",
      status: "uploading",
      sizeBytes: 1000n,
      googleSessionUri: "https://upload.example/session",
      targetConnectedAccountId: "acct-1",
    });
    prismaMock.connectedAccount.findFirstOrThrow.mockResolvedValue(
      eligibleAccount,
    );
    queryGoogleDriveResumableStatus.mockRejectedValue(
      new Error("provider offline"),
    );

    const response = await resumableStatus(
      new Request("http://localhost/uploads/resumable/status/sess-r1"),
      { params: Promise.resolve({ id: "sess-r1" }) },
    );
    const body = await readJson(response);

    // Characterization: catch-all returns failed/0 rather than an error code.
    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "failed", offset: "0" });
  });
});

describe("resumableChunkHandler", () => {
  beforeEach(() => {
    authed();
    syncGoogleQuota.mockResolvedValue(undefined);
  });

  it("happy path: completes a chunk upload via the seam", async () => {
    prismaMock.uploadSession.findFirstOrThrow.mockResolvedValue({
      id: "sess-r1",
      userId: "user-1",
      folderId: null,
      fileName: "video.mp4",
      mimeType: "video/mp4",
      googleSessionUri: "https://upload.example/session",
      targetConnectedAccountId: "acct-1",
    });
    prismaMock.connectedAccount.findFirstOrThrow.mockResolvedValue(
      eligibleAccount,
    );
    putGoogleDriveResumableChunk.mockResolvedValue(
      Response.json(
        { id: "g-file-2", name: "video.mp4", mimeType: "video/mp4" },
        { status: 200 },
      ),
    );
    prismaMock.file.findFirst.mockResolvedValue(null);
    prismaMock.file.create.mockResolvedValue({
      id: "file-2",
      name: "video.mp4",
      mimeType: "video/mp4",
      sizeBytes: 10n,
    });
    prismaMock.uploadSession.update.mockResolvedValue({});

    const response = await resumableChunk(
      new Request("http://localhost/uploads/resumable/chunk/sess-r1", {
        method: "PUT",
        headers: {
          "content-range": "bytes 0-9/10",
          "content-type": "application/octet-stream",
        },
        body: Buffer.from("0123456789"),
      }),
      { params: Promise.resolve({ id: "sess-r1" }) },
    );
    const body = await readJson(response);

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      status: "completed",
      file: { id: "file-2", sizeBytes: "10" },
    });
    expect(putGoogleDriveResumableChunk).toHaveBeenCalledTimes(1);
  });

  it("returns UPLOAD_FAILED when the provider chunk put fails", async () => {
    prismaMock.uploadSession.findFirstOrThrow.mockResolvedValue({
      id: "sess-r1",
      userId: "user-1",
      folderId: null,
      fileName: "video.mp4",
      mimeType: "video/mp4",
      googleSessionUri: "https://upload.example/session",
      targetConnectedAccountId: "acct-1",
    });
    prismaMock.connectedAccount.findFirstOrThrow.mockResolvedValue(
      eligibleAccount,
    );
    putGoogleDriveResumableChunk.mockResolvedValue(
      new Response("quota exceeded on drive", { status: 403 }),
    );
    prismaMock.uploadSession.update.mockResolvedValue({});

    const response = await resumableChunk(
      new Request("http://localhost/uploads/resumable/chunk/sess-r1", {
        method: "PUT",
        headers: {
          "content-range": "bytes 0-9/10",
        },
        body: Buffer.from("0123456789"),
      }),
      { params: Promise.resolve({ id: "sess-r1" }) },
    );
    const body = await readJson(response);

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      code: "UPLOAD_FAILED",
      message: "quota exceeded on drive",
    });
  });

  it("returns MISSING_CONTENT_RANGE when header is absent", async () => {
    prismaMock.uploadSession.findFirstOrThrow.mockResolvedValue({
      id: "sess-r1",
      userId: "user-1",
      googleSessionUri: "https://upload.example/session",
      targetConnectedAccountId: "acct-1",
    });

    const response = await resumableChunk(
      new Request("http://localhost/uploads/resumable/chunk/sess-r1", {
        method: "PUT",
        body: Buffer.from("x"),
      }),
      { params: Promise.resolve({ id: "sess-r1" }) },
    );
    const body = await readJson(response);
    expect(response.status).toBe(400);
    expect(body.code).toBe("MISSING_CONTENT_RANGE");
  });
});
