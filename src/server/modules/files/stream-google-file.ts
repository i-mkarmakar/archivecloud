import "server-only";

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

// Stable import path: Google Drive streaming lives under providers/google.
export {
  fetchGoogleDriveFileMedia,
  type GoogleProviderFile,
  googleDownloadExportMimeTypes,
  normalizeHeaders,
  streamGoogleDriveThumbnailResponse,
  streamGoogleFileResponse,
  streamGoogleProviderFileResponse,
  withExtension,
} from "@/server/modules/providers/google/drive-stream";
