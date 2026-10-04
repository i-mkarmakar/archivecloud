import "server-only";

import { Readable } from "node:stream";
import type { ConnectedAccount, File } from "@/generated/prisma/client";
import { prisma } from "@/server/config/prisma";
import { errorJson } from "@/server/http/responses";
import { destroyStreamOnAbort } from "@/server/modules/files/abort-stream";
import { applyContentLengthHeader } from "@/server/modules/files/content-length";
import { applyPublicByteSafetyHeaders } from "@/server/modules/files/public-byte-headers";
import { publicStreamErrorResponse } from "@/server/modules/files/public-stream-errors";
import {
  streamGoogleDriveThumbnailResponse,
  streamGoogleFileResponse,
} from "@/server/modules/providers/google/drive-stream";
import { pullProviderFile } from "@/server/modules/providers/operations";

type FileWithAccount = File & { connectedAccount: ConnectedAccount };
export type StreamOptions = {
  disposition?: "inline" | "attachment";
  /** Client disconnect — aborts upstream provider fetch. */
  signal?: AbortSignal;
};

async function findPhotosImportDest(file: FileWithAccount) {
  return prisma.transferJob.findFirst({
    where: {
      userId: file.userId,
      sourceAccountId: file.connectedAccountId,
      sourceProviderFileId: file.providerFileId,
      status: "completed",
      destProviderFileId: { not: null },
    },
    orderBy: { completedAt: "desc" },
    include: { destAccount: true },
  });
}

async function streamGooglePhotosImportedFileResponse(
  file: FileWithAccount,
  _range: string | undefined,
  options: StreamOptions = {},
): Promise<Response> {
  // App-created / uploaded-into Photos: bytes live on Photos itself.
  try {
    const pulled = await pullProviderFile(
      file.connectedAccount,
      file.providerFileId,
      file.name,
      options.signal,
    );
    destroyStreamOnAbort(pulled.stream, options.signal);
    const headers = new Headers();
    applyPublicByteSafetyHeaders(headers, {
      mimeType: pulled.mimeType || file.mimeType,
      fileName: pulled.name || file.name,
      preferredDisposition: options.disposition ?? "attachment",
    });
    applyContentLengthHeader(headers, {
      providerContentLength: pulled.providerContentLength,
      sizeBytes: pulled.sizeBytes,
    });
    headers.set("Cache-Control", "private, max-age=300");
    const webStream = Readable.toWeb(pulled.stream) as ReadableStream;
    return new Response(webStream, { status: 200, headers });
  } catch {
    // Fall through: picker copies store durable bytes on another cloud.
  }

  const job = await findPhotosImportDest(file);

  if (!job?.destProviderFileId || !job.destAccount) {
    return errorJson(
      "PHOTOS_FILE_BYTES_UNAVAILABLE",
      "This Google Photos item has no stored copy yet. Copy it to another cloud first.",
      404,
    );
  }

  if (job.destAccount.provider === "google_photos") {
    return errorJson(
      "PHOTOS_FILE_BYTES_UNAVAILABLE",
      "This Google Photos item has no stored copy yet. Copy it to another cloud first.",
      404,
    );
  }

  try {
    const pulled = await pullProviderFile(
      job.destAccount,
      job.destProviderFileId,
      file.name,
      options.signal,
    );
    destroyStreamOnAbort(pulled.stream, options.signal);
    const headers = new Headers();
    applyPublicByteSafetyHeaders(headers, {
      mimeType: pulled.mimeType || file.mimeType,
      fileName: pulled.name || file.name,
      preferredDisposition: options.disposition ?? "attachment",
    });
    applyContentLengthHeader(headers, {
      providerContentLength: pulled.providerContentLength,
      sizeBytes: pulled.sizeBytes,
    });
    headers.set("Cache-Control", "private, max-age=300");
    const webStream = Readable.toWeb(pulled.stream) as ReadableStream;
    return new Response(webStream, { status: 200, headers });
  } catch (error) {
    return publicStreamErrorResponse(error, {
      logLabel: "Google Photos imported file stream failed:",
    });
  }
}

/** Thumbnail for Photos imports: prefer dest-provider thumb, else image bytes. */
export async function streamGooglePhotosThumbnailResponse(
  file: FileWithAccount,
): Promise<Response> {
  const job = await findPhotosImportDest(file);
  if (job?.destProviderFileId && job.destAccount) {
    const dest = job.destAccount;
    const destId = job.destProviderFileId;
    if (
      dest.provider === "google_drive" ||
      dest.provider === "google_shared_drive"
    ) {
      return streamGoogleDriveThumbnailResponse(dest, destId);
    }
    if (dest.provider === "dropbox") {
      const { streamDropboxThumbnailResponse } = await import(
        "@/server/modules/dropbox/dropbox.service"
      );
      return streamDropboxThumbnailResponse(dest, destId);
    }
    if (dest.provider === "onedrive") {
      const { streamOneDriveThumbnailResponse } = await import(
        "@/server/modules/onedrive/onedrive.service"
      );
      return streamOneDriveThumbnailResponse(dest, destId);
    }
    if (dest.provider === "pcloud") {
      const { streamPCloudThumbnailResponse } = await import(
        "@/server/modules/pcloud/pcloud.service"
      );
      return streamPCloudThumbnailResponse(dest, destId);
    }
  }

  if (file.mimeType.startsWith("image/")) {
    return streamGooglePhotosImportedFileResponse(file, undefined, {
      disposition: "inline",
    });
  }

  return errorJson(
    "THUMBNAIL_NOT_AVAILABLE",
    "No thumbnail available for this file.",
    404,
  );
}

export async function streamProviderFileResponse(
  file: FileWithAccount,
  range: string | undefined,
  options: StreamOptions = {},
): Promise<Response> {
  if (file.connectedAccount.provider === "google_photos") {
    return streamGooglePhotosImportedFileResponse(file, range, options);
  }
  if (
    file.connectedAccount.provider === "google_drive" ||
    file.connectedAccount.provider === "google_shared_drive"
  ) {
    return streamGoogleFileResponse(file, range, options);
  }

  try {
    const pulled = await pullProviderFile(
      file.connectedAccount,
      file.providerFileId,
      file.name,
      options.signal,
    );
    destroyStreamOnAbort(pulled.stream, options.signal);
    const headers = new Headers();
    applyPublicByteSafetyHeaders(headers, {
      mimeType: pulled.mimeType || file.mimeType,
      fileName: pulled.name || file.name,
      preferredDisposition: options.disposition ?? "attachment",
    });
    applyContentLengthHeader(headers, {
      providerContentLength: pulled.providerContentLength,
      sizeBytes: pulled.sizeBytes,
    });
    headers.set("Cache-Control", "private, max-age=60");
    const webStream = Readable.toWeb(pulled.stream) as ReadableStream;
    return new Response(webStream, { status: 200, headers });
  } catch (error) {
    return publicStreamErrorResponse(error, {
      logLabel: `Stream failed for ${file.connectedAccount.provider}:`,
    });
  }
}
