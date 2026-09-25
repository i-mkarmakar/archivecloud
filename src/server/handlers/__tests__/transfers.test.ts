import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  asRoute,
  authed,
  jsonRequest,
  prismaMock,
  readJson,
  unauthenticated,
} from "./handler-test-utils";

const getProviderFileMeta = vi.fn();
const enqueueTransferJob = vi.fn();
const assertTransferCapacity = vi.fn();
const getTransferUsage = vi.fn();

vi.mock("@/server/modules/providers/operations", () => ({
  getProviderFileMeta: (...args: unknown[]) => getProviderFileMeta(...args),
}));

vi.mock("@/server/modules/transfers/process-job", () => ({
  enqueueTransferJob: (...args: unknown[]) => enqueueTransferJob(...args),
}));

vi.mock("@/server/modules/transfers/usage", () => ({
  assertTransferCapacity: (...args: unknown[]) =>
    assertTransferCapacity(...args),
  getTransferUsage: (...args: unknown[]) => getTransferUsage(...args),
}));

import { createTransferCopyHandler } from "@/server/handlers/transfers";

const createTransfer = asRoute(createTransferCopyHandler);

const sourceAccount = {
  id: "src-acct",
  userId: "user-1",
  status: "connected",
  provider: "google_drive",
  email: "src@example.com",
  displayName: "Source",
};
const destAccount = {
  id: "dst-acct",
  userId: "user-1",
  status: "connected",
  provider: "dropbox",
  email: "dst@example.com",
  displayName: "Dest",
};

function jobRecord(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-01-15T12:00:00.000Z");
  return {
    id: "job-1",
    type: "copy",
    status: "queued",
    sourceAccountId: "src-acct",
    destAccountId: "dst-acct",
    sourceProviderFileId: "prov-file-1",
    destProviderFileId: null,
    destParentId: null,
    fileName: "report.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1024n,
    transferredBytes: 0n,
    errorMessage: null,
    startedAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    sourceAccount: { email: sourceAccount.email, displayName: "Source" },
    destAccount: { email: destAccount.email, displayName: "Dest" },
    ...overrides,
  };
}

describe("createTransferCopyHandler", () => {
  beforeEach(() => {
    authed();
    assertTransferCapacity.mockResolvedValue(undefined);
    enqueueTransferJob.mockReturnValue(undefined);
    prismaMock.connectedAccount.findFirst.mockImplementation(
      async (args: { where?: { id?: string } }) => {
        if (args.where?.id === "src-acct") return sourceAccount;
        if (args.where?.id === "dst-acct") return destAccount;
        return null;
      },
    );
  });

  it("happy path: queues a copy job from provider file meta", async () => {
    getProviderFileMeta.mockResolvedValue({
      name: "report.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024n,
    });
    prismaMock.transferJob.create.mockResolvedValue(jobRecord());

    const response = await createTransfer(
      jsonRequest("http://localhost/transfers/copy", {
        sourceAccountId: "src-acct",
        destAccountId: "dst-acct",
        sourceProviderFileId: "prov-file-1",
      }),
    );
    const body = await readJson(response);

    expect(response.status).toBe(201);
    expect(body.job).toMatchObject({
      id: "job-1",
      status: "queued",
      fileName: "report.pdf",
      sizeBytes: "1024",
    });
    expect(enqueueTransferJob).toHaveBeenCalledWith("job-1");
  });

  it("returns 401 when unauthenticated", async () => {
    unauthenticated();
    const response = await createTransfer(
      jsonRequest("http://localhost/transfers/copy", {
        sourceAccountId: "src-acct",
        destAccountId: "dst-acct",
        sourceProviderFileId: "prov-file-1",
      }),
    );
    const body = await readJson(response);
    expect(response.status).toBe(401);
    expect(body.code).toBe("AUTH_REQUIRED");
  });

  it("returns VALIDATION_ERROR for invalid Zod input", async () => {
    const response = await createTransfer(
      jsonRequest("http://localhost/transfers/copy", {
        sourceAccountId: "",
        destAccountId: "dst-acct",
        sourceProviderFileId: "prov-file-1",
      }),
    );
    const body = await readJson(response);
    expect(response.status).toBe(400);
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("returns TRANSFER_LIMIT_EXCEEDED when quota is exceeded", async () => {
    getProviderFileMeta.mockResolvedValue({
      name: "report.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024n,
    });
    assertTransferCapacity.mockRejectedValue(
      new Error("This transfer exceeds your free plan bandwidth."),
    );

    const response = await createTransfer(
      jsonRequest("http://localhost/transfers/copy", {
        sourceAccountId: "src-acct",
        destAccountId: "dst-acct",
        sourceProviderFileId: "prov-file-1",
      }),
    );
    const body = await readJson(response);

    expect(response.status).toBe(402);
    expect(body).toMatchObject({
      code: "TRANSFER_LIMIT_EXCEEDED",
      message: "This transfer exceeds your free plan bandwidth.",
    });
  });

  it("returns FILE_NOT_FOUND when provider meta lookup fails", async () => {
    getProviderFileMeta.mockRejectedValue(new Error("provider offline"));

    const response = await createTransfer(
      jsonRequest("http://localhost/transfers/copy", {
        sourceAccountId: "src-acct",
        destAccountId: "dst-acct",
        sourceProviderFileId: "prov-file-1",
      }),
    );
    const body = await readJson(response);

    // Characterization: resolveProviderFileMeta swallows provider errors → 404.
    expect(response.status).toBe(404);
    expect(body.code).toBe("FILE_NOT_FOUND");
  });
});
