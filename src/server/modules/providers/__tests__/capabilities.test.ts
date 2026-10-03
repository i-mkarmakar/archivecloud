import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { ConnectedAccount } from "@/generated/prisma/client";
import { AppHttpError } from "@/server/http/app-error";
import {
  deleteICloudFile,
  downloadICloudFileStream,
  uploadICloudFileFromStream,
} from "@/server/modules/icloud/icloud.service";
import {
  deleteProviderFile,
  moveProviderItem,
  pullProviderFile,
  pushPulledFileToProvider,
  renameProviderFile,
} from "@/server/modules/providers/operations";
import {
  assertProviderCapability,
  providerSupports,
  providerSupportsMove,
} from "@/server/modules/providers/types";

function icloudAccount(
  provider: "icloud_drive" | "icloud_photos" = "icloud_drive",
): ConnectedAccount {
  return {
    id: "acct-icloud",
    userId: "user-1",
    provider,
  } as ConnectedAccount;
}

describe("provider capabilities", () => {
  it("marks Google Drive as full-featured and iCloud as connection-only", () => {
    expect(providerSupports("google_drive", "supportsUpload")).toBe(true);
    expect(providerSupports("google_drive", "supportsDownload")).toBe(true);
    expect(providerSupportsMove("google_drive")).toBe(true);

    expect(providerSupports("icloud_drive", "supportsUpload")).toBe(false);
    expect(providerSupports("icloud_drive", "supportsDownload")).toBe(false);
    expect(providerSupports("icloud_drive", "supportsDelete")).toBe(false);
    expect(providerSupports("icloud_photos", "supportsRename")).toBe(false);
    expect(providerSupportsMove("icloud_drive")).toBe(false);
    expect(providerSupports("icloud_drive", "supportsBrowse")).toBe(true);
  });

  it("assertProviderCapability throws NOT_SUPPORTED for iCloud upload", () => {
    expect(() =>
      assertProviderCapability("icloud_drive", "supportsUpload"),
    ).toThrow(AppHttpError);

    try {
      assertProviderCapability("icloud_drive", "supportsUpload");
    } catch (error) {
      expect(error).toMatchObject({
        code: "NOT_SUPPORTED",
        status: 400,
        message: "Upload is not supported for iCloud Drive.",
      });
    }
  });
});

describe("iCloud transfer stubs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects upload/download/delete with NOT_SUPPORTED", async () => {
    const account = icloudAccount();

    await expect(
      uploadICloudFileFromStream({
        account,
        parentId: "root",
        fileName: "a.txt",
        mimeType: "text/plain",
        body: Readable.from(["x"]),
      }),
    ).rejects.toMatchObject({
      code: "NOT_SUPPORTED",
      message: "Upload is not supported for iCloud Drive.",
    });

    await expect(
      downloadICloudFileStream(account, "file-1"),
    ).rejects.toMatchObject({
      code: "NOT_SUPPORTED",
      message: "Download is not supported for iCloud Drive.",
    });

    await expect(deleteICloudFile(account, "file-1")).rejects.toMatchObject({
      code: "NOT_SUPPORTED",
      message: "Delete is not supported for iCloud Drive.",
    });
  });

  it("operations facade does not fake success for iCloud transfers", async () => {
    const account = icloudAccount("icloud_photos");

    await expect(pullProviderFile(account, "file-1")).rejects.toMatchObject({
      code: "NOT_SUPPORTED",
    });

    await expect(
      pushPulledFileToProvider(account, {
        stream: Readable.from(["x"]),
        mimeType: "text/plain",
        name: "a.txt",
        sizeBytes: 1n,
      }),
    ).rejects.toMatchObject({ code: "NOT_SUPPORTED" });

    await expect(
      deleteProviderFile({ account, providerFileId: "file-1" }),
    ).rejects.toMatchObject({ code: "NOT_SUPPORTED" });

    await expect(
      renameProviderFile({
        account,
        providerFileId: "file-1",
        newName: "b.txt",
      }),
    ).rejects.toMatchObject({ code: "NOT_SUPPORTED" });

    await expect(
      moveProviderItem({
        account,
        providerItemId: "file-1",
        destParentId: "root",
      }),
    ).rejects.toMatchObject({ code: "NOT_SUPPORTED" });
  });
});
