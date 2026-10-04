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
  it("marks iCloud Drive and Photos as ACH-capable", () => {
    expect(providerSupports("google_drive", "supportsUpload")).toBe(true);
    expect(providerSupportsMove("google_drive")).toBe(true);

    expect(providerSupports("icloud_drive", "supportsUpload")).toBe(true);
    expect(providerSupports("icloud_drive", "supportsDownload")).toBe(true);
    expect(providerSupports("icloud_drive", "supportsDelete")).toBe(true);
    expect(providerSupportsMove("icloud_drive")).toBe(true);

    expect(providerSupports("icloud_photos", "supportsDownload")).toBe(true);
    expect(providerSupports("icloud_photos", "supportsUpload")).toBe(true);
    expect(providerSupports("icloud_photos", "supportsDelete")).toBe(true);
    expect(providerSupports("icloud_photos", "supportsRename")).toBe(false);
    expect(providerSupportsMove("icloud_photos")).toBe(true);
  });

  it("assertProviderCapability still blocks rename for iCloud", () => {
    expect(() =>
      assertProviderCapability("icloud_photos", "supportsRename"),
    ).toThrow(AppHttpError);
  });
});

describe("iCloud transfer stubs without session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails closed without an encrypted session", async () => {
    const drive = icloudAccount("icloud_drive");
    const photos = icloudAccount("icloud_photos");

    await expect(
      uploadICloudFileFromStream({
        account: drive,
        parentId: "root",
        fileName: "a.txt",
        mimeType: "text/plain",
        body: Readable.from(["x"]),
      }),
    ).rejects.toThrow();

    await expect(downloadICloudFileStream(drive, "file-1")).rejects.toThrow();
    await expect(deleteICloudFile(photos, "file-1")).rejects.toThrow();
    await expect(pullProviderFile(photos, "file-1")).rejects.toThrow();

    await expect(
      renameProviderFile({
        account: photos,
        providerFileId: "file-1",
        newName: "b.txt",
      }),
    ).rejects.toMatchObject({ code: "NOT_SUPPORTED" });

    // Cross-cloud move uses transfer jobs; in-provider move stays unsupported.
    await expect(
      moveProviderItem({
        account: drive,
        providerItemId: "file-1",
        destParentId: "root",
      }),
    ).rejects.toThrow();
  });
});
