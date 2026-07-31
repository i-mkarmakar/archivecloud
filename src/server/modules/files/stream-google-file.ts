import type { ConnectedAccount, File } from "@/generated/prisma/client";
import { errorJson } from "@/server/http/responses";
import { getAuthedGoogleClient } from "../google/google.service";

type FileWithAccount = File & { connectedAccount: ConnectedAccount };
type StreamOptions = { disposition?: "inline" | "attachment" };

export const googleDownloadExportMimeTypes: Record<
  string,
  { mimeType: string; extension: string }
> = {
  "application/vnd.google-apps.document": {
    mimeType: "application/pdf",
    extension: ".pdf",
  },
  "application/vnd.google-apps.spreadsheet": {
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extension: ".xlsx",
  },
  "application/vnd.google-apps.presentation": {
    mimeType: "application/pdf",
    extension: ".pdf",
  },
  "application/vnd.google-apps.drawing": {
    mimeType: "image/png",
    extension: ".png",
  },
};

const googlePreviewExportMimeTypes: Record<
  string,
  { mimeType: string; extension: string }
> = {
  ...googleDownloadExportMimeTypes,
  "application/vnd.google-apps.spreadsheet": {
    mimeType: "application/pdf",
    extension: ".pdf",
  },
};

function contentDisposition(type: "inline" | "attachment", fileName: string) {
  return `${type}; filename="${fileName.replaceAll('"', "")}"`;
}

export function withExtension(fileName: string, extension: string) {
  return fileName.toLowerCase().endsWith(extension)
    ? fileName
    : `${fileName}${extension}`;
}

export function normalizeHeaders(headers: Headers | Record<string, string>) {
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  return headers;
}

export async function streamGoogleFileResponse(
  file: FileWithAccount,
  range: string | undefined,
  options: StreamOptions = {},
): Promise<Response> {
  const auth = await getAuthedGoogleClient(file.connectedAccount);
  const headers = normalizeHeaders(await auth.getRequestHeaders());
  const exportTarget = (
    options.disposition === "inline"
      ? googlePreviewExportMimeTypes
      : googleDownloadExportMimeTypes
  )[file.mimeType];
  const responseMimeType = exportTarget?.mimeType ?? file.mimeType;
  const responseFileName = exportTarget
    ? withExtension(file.name, exportTarget.extension)
    : file.name;
  const url = exportTarget
    ? `https://www.googleapis.com/drive/v3/files/${file.providerFileId}/export?mimeType=${encodeURIComponent(exportTarget.mimeType)}`
    : `https://www.googleapis.com/drive/v3/files/${file.providerFileId}?alt=media`;
  const response = await fetch(url, {
    headers: {
      ...headers,
      ...(range && !exportTarget ? { Range: range } : {}),
    },
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    return errorJson(
      "GOOGLE_FILE_STREAM_FAILED",
      message || response.statusText,
      response.status,
    );
  }

  const outHeaders = new Headers();
  outHeaders.set("Content-Type", responseMimeType);
  outHeaders.set("Accept-Ranges", "bytes");
  if (options.disposition)
    outHeaders.set(
      "Content-Disposition",
      contentDisposition(options.disposition, responseFileName),
    );

  const contentLength = response.headers.get("content-length");
  const contentRange = response.headers.get("content-range");
  if (contentLength) outHeaders.set("Content-Length", contentLength);
  if (contentRange) outHeaders.set("Content-Range", contentRange);

  return new Response(response.body, {
    status: response.status,
    headers: outHeaders,
  });
}
