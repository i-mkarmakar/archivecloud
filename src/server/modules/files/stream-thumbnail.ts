import "server-only";

import { Readable } from "node:stream";
import type { ConnectedAccount, File } from "@/generated/prisma/client";
import { prisma } from "@/server/config/prisma";
import { errorJson } from "@/server/http/responses";
import { streamDropboxThumbnailResponse } from "@/server/modules/dropbox/dropbox.service";
import { streamGooglePhotosThumbnailResponse } from "@/server/modules/files/stream-file";
import { streamOneDriveThumbnailResponse } from "@/server/modules/onedrive/onedrive.service";
import { streamPCloudThumbnailResponse } from "@/server/modules/pcloud/pcloud.service";
import { streamGoogleDriveThumbnailResponse } from "@/server/modules/providers/google/drive-stream";
import { pullProviderFile } from "@/server/modules/providers/operations";

type FileWithAccount = File & { connectedAccount: ConnectedAccount };

function looksLikeImage(mimeType?: string | null, fileName?: string | null) {
  if (mimeType?.startsWith("image/")) return true;
  return Boolean(
    fileName &&
      /\.(heic|heif|jpe?g|png|gif|webp|bmp|svg|tiff?)$/i.test(fileName),
  );
}

function looksLikeVideo(mimeType?: string | null, fileName?: string | null) {
  if (mimeType?.startsWith("video/")) return true;
  return Boolean(
    fileName && /\.(mp4|mov|avi|mkv|webm|m4v|3gp)$/i.test(fileName),
  );
}

async function streamImageBytesFallback(
  account: ConnectedAccount,
  providerFileId: string,
  mimeType?: string | null,
  fileName?: string | null,
): Promise<Response> {
  if (!looksLikeImage(mimeType, fileName)) {
    return errorJson(
      "THUMBNAIL_NOT_AVAILABLE",
      "No thumbnail available for this file.",
      404,
    );
  }
  const pulled = await pullProviderFile(
    account,
    providerFileId,
    fileName ?? undefined,
  );
  const headers = new Headers();
  headers.set("Content-Type", pulled.mimeType || mimeType || "image/jpeg");
  headers.set("Cache-Control", "private, max-age=300");
  if (pulled.sizeBytes > 0n) {
    headers.set("Content-Length", pulled.sizeBytes.toString());
  }
  return new Response(Readable.toWeb(pulled.stream) as ReadableStream, {
    status: 200,
    headers,
  });
}

/** Thumbnail for a provider file on a connected account. */
export async function streamAccountFileThumbnail(
  account: ConnectedAccount,
  providerFileId: string,
  options?: { mimeType?: string | null; fileName?: string | null },
): Promise<Response> {
  const mimeType = options?.mimeType ?? null;
  const fileName = options?.fileName ?? null;

  try {
    switch (account.provider) {
      case "google_drive":
      case "google_shared_drive":
        return streamGoogleDriveThumbnailResponse(account, providerFileId);
      case "google_photos": {
        const file = await prisma.file.findFirst({
          where: {
            connectedAccountId: account.id,
            providerFileId,
            provider: "google_photos",
            status: "active",
          },
          include: { connectedAccount: true },
        });
        if (!file) {
          return errorJson(
            "THUMBNAIL_NOT_AVAILABLE",
            "No thumbnail available for this file.",
            404,
          );
        }
        return streamGooglePhotosThumbnailResponse(file);
      }
      case "dropbox":
        return streamDropboxThumbnailResponse(account, providerFileId);
      case "onedrive":
        return streamOneDriveThumbnailResponse(account, providerFileId);
      case "pcloud":
        return streamPCloudThumbnailResponse(account, providerFileId);
      default:
        return streamImageBytesFallback(
          account,
          providerFileId,
          mimeType,
          fileName,
        );
    }
  } catch (error) {
    // Provider thumb APIs often fail for obscure types — fall back to image bytes.
    if (looksLikeImage(mimeType, fileName)) {
      try {
        return await streamImageBytesFallback(
          account,
          providerFileId,
          mimeType,
          fileName,
        );
      } catch {
        // ignore and return below
      }
    }
    console.error(
      `Thumbnail failed for ${account.provider}:${providerFileId}:`,
      error,
    );
    return errorJson(
      "THUMBNAIL_NOT_AVAILABLE",
      error instanceof Error ? error.message : "No thumbnail available.",
      404,
    );
  }
}

/** Thumbnail for a DB File row (All Files / Shared / Trash / Photos). */
export async function streamDbFileThumbnail(
  file: FileWithAccount,
): Promise<Response> {
  if (file.connectedAccount.provider === "google_photos") {
    return streamGooglePhotosThumbnailResponse(file);
  }
  return streamAccountFileThumbnail(
    file.connectedAccount,
    file.providerFileId,
    {
      mimeType: file.mimeType,
      fileName: file.name,
    },
  );
}

export function fileLikelyHasThumbnail(
  mimeType?: string | null,
  fileName?: string | null,
) {
  return (
    looksLikeImage(mimeType, fileName) || looksLikeVideo(mimeType, fileName)
  );
}
