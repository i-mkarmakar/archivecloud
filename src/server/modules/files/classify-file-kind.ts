import "server-only";

export type FileKindBucket = "photo" | "video" | "document";

export function classifyFileKind(mimeType: string): FileKindBucket {
  const normalized = mimeType.toLowerCase();
  if (
    normalized.startsWith("image/") ||
    normalized === "application/vnd.google-apps.photo"
  ) {
    return "photo";
  }
  if (normalized.startsWith("video/") || normalized.startsWith("audio/")) {
    return "video";
  }
  return "document";
}

export function classifyFileName(name: string): FileKindBucket {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (
    ["jpg", "jpeg", "png", "gif", "webp", "heic", "bmp", "svg"].includes(ext)
  ) {
    return "photo";
  }
  if (
    [
      "mp4",
      "mov",
      "avi",
      "mkv",
      "webm",
      "m4v",
      "mp3",
      "wav",
      "aac",
      "flac",
    ].includes(ext)
  ) {
    return "video";
  }
  return "document";
}
