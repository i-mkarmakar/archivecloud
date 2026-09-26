import "server-only";

import { Readable } from "node:stream";
import type { ConnectedAccount, File } from "@/generated/prisma/client";
import { prisma } from "@/server/config/prisma";
import { errorJson } from "@/server/http/responses";
import { streamGoogleFileResponse } from "@/server/modules/providers/google/drive-stream";
import { pullProviderFile } from "@/server/modules/providers/operations";

type FileWithAccount = File & { connectedAccount: ConnectedAccount };
type StreamOptions = { disposition?: "inline" | "attachment" };

function contentDisposition(type: "inline" | "attachment", fileName: string) {
  return `${type}; filename="${fileName.replaceAll('"', "")}"`;
}

async function streamGooglePhotosImportedFileResponse(
  file: FileWithAccount,
  _range: string | undefined,
  options: StreamOptions = {},
): Promise<Response> {
  const job = await prisma.transferJob.findFirst({
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

  if (!job?.destProviderFileId || !job.destAccount) {
    return errorJson(
      "PHOTOS_FILE_BYTES_UNAVAILABLE",
      "This Google Photos import has no stored copy yet. Connect another cloud and import again.",
      404,
    );
  }

  // Skip if dest was the same photos account (reference-only import).
  if (job.destAccount.provider === "google_photos") {
    return errorJson(
      "PHOTOS_FILE_BYTES_UNAVAILABLE",
      "This Google Photos import has no stored copy yet. Connect another cloud and import again.",
      404,
    );
  }

  try {
    const pulled = await pullProviderFile(
      job.destAccount,
      job.destProviderFileId,
      file.name,
    );
    const headers = new Headers();
    headers.set("Content-Type", pulled.mimeType || file.mimeType);
    if (options.disposition) {
      headers.set(
        "Content-Disposition",
        contentDisposition(options.disposition, pulled.name || file.name),
      );
    }
    if (pulled.sizeBytes > 0n) {
      headers.set("Content-Length", pulled.sizeBytes.toString());
    }
    const webStream = Readable.toWeb(pulled.stream) as ReadableStream;
    return new Response(webStream, { status: 200, headers });
  } catch (error) {
    console.error("Google Photos imported file stream failed:", error);
    return errorJson(
      "PHOTOS_FILE_STREAM_FAILED",
      error instanceof Error ? error.message : "Failed to stream file.",
      502,
    );
  }
}

export function streamProviderFileResponse(
  file: FileWithAccount,
  range: string | undefined,
  options: StreamOptions = {},
): Promise<Response> {
  if (file.connectedAccount.provider === "google_photos") {
    return streamGooglePhotosImportedFileResponse(file, range, options);
  }
  return streamGoogleFileResponse(file, range, options);
}
