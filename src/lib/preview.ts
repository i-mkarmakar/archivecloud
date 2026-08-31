export type PreviewKind = "image" | "video" | "document" | "office";

const officeMimeTypes = new Set([
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const googleDocumentMimeTypes = new Set([
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.spreadsheet",
  "application/vnd.google-apps.presentation",
]);

export function getPreviewKind(
  mimeType: string | undefined,
  fileName?: string,
): PreviewKind | null {
  if (!mimeType && !fileName) return null;
  const mime = mimeType ?? "";
  if (
    mime.startsWith("image/") ||
    mime === "application/vnd.google-apps.drawing" ||
    (fileName &&
      /\.(heic|heif|jpe?g|png|gif|webp|bmp|svg|tiff?)$/i.test(fileName))
  )
    return "image";
  if (
    mime.startsWith("video/") ||
    (fileName && /\.(mp4|mov|avi|mkv|webm|m4v|3gp)$/i.test(fileName))
  )
    return "video";
  if (mime === "application/pdf" || googleDocumentMimeTypes.has(mime))
    return "document";
  if (officeMimeTypes.has(mime)) return "office";
  if (fileName && /\.pdf$/i.test(fileName)) return "document";
  return null;
}

export function officeViewerUrl(fileUrl: string) {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
}

export function isSpreadsheetMimeType(mimeType: string | undefined) {
  return (
    mimeType === "application/vnd.google-apps.spreadsheet" ||
    mimeType === "application/vnd.ms-excel" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}
