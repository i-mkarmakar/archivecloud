import { google } from "googleapis";
import type { ConnectedAccount, File } from "@/generated/prisma/client";
import { errorJson } from "@/server/http/responses";
import { getAuthedGoogleClient } from "../google/google.service";

type FileWithAccount = File & { connectedAccount: ConnectedAccount };
type StreamOptions = { disposition?: "inline" | "attachment" };

export type GoogleProviderFile = {
  providerFileId: string;
  mimeType: string;
  name: string;
};

const browserInlineImageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
]);

export function isBrowserInlineImageMimeType(
  mimeType: string,
  fileName: string,
) {
  if (browserInlineImageMimeTypes.has(mimeType)) return true;
  return /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(fileName);
}

export function isHeicLike(mimeType: string, fileName: string) {
  return (
    mimeType === "image/heic" ||
    mimeType === "image/heif" ||
    /\.heic$/i.test(fileName) ||
    /\.heif$/i.test(fileName)
  );
}

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

export function normalizeHeaders(
  headers: Headers | Record<string, string> | Array<[string, string]> | object,
) {
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);

  const maybeMap = headers as {
    forEach?: (cb: (value: string, key: string) => void) => void;
    Authorization?: string;
    authorization?: string;
  };
  if (
    typeof maybeMap.forEach === "function" &&
    maybeMap.Authorization == null &&
    maybeMap.authorization == null
  ) {
    const out: Record<string, string> = {};
    maybeMap.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }

  return headers as Record<string, string>;
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

export async function streamGoogleProviderFileResponse(
  account: ConnectedAccount,
  file: GoogleProviderFile,
  range: string | undefined,
  options: StreamOptions = {},
): Promise<Response> {
  const auth = await getAuthedGoogleClient(account);
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
  if (options.disposition) {
    outHeaders.set(
      "Content-Disposition",
      contentDisposition(options.disposition, responseFileName),
    );
  }

  const contentLength = response.headers.get("content-length");
  const contentRange = response.headers.get("content-range");
  if (contentLength) outHeaders.set("Content-Length", contentLength);
  if (contentRange) outHeaders.set("Content-Range", contentRange);

  return new Response(response.body, {
    status: response.status,
    headers: outHeaders,
  });
}

export async function streamGoogleDriveThumbnailResponse(
  account: ConnectedAccount,
  providerFileId: string,
): Promise<Response> {
  const auth = await getAuthedGoogleClient(account);
  const drive = google.drive({ version: "v3", auth });
  const metadata = await drive.files.get({
    fileId: providerFileId,
    fields: "thumbnailLink",
    supportsAllDrives: true,
  });
  const thumbnailLink = metadata.data.thumbnailLink;
  if (!thumbnailLink) {
    return errorJson(
      "THUMBNAIL_NOT_AVAILABLE",
      "No thumbnail available for this file.",
      404,
    );
  }

  const headers = normalizeHeaders(await auth.getRequestHeaders());
  const response = await fetch(thumbnailLink, { headers });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    return errorJson(
      "GOOGLE_THUMBNAIL_FAILED",
      message || response.statusText,
      response.status,
    );
  }

  const outHeaders = new Headers();
  outHeaders.set(
    "Content-Type",
    response.headers.get("content-type") ?? "image/jpeg",
  );
  outHeaders.set("Cache-Control", "private, max-age=300");
  return new Response(response.body, { status: 200, headers: outHeaders });
}
