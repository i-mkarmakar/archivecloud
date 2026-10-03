import type { FileItem } from "@/data/drive-data";
import { cn } from "@/lib/utils";

export type FileTypeIconName =
  | "archives"
  | "audio"
  | "documents"
  | "forms"
  | "images"
  | "markdown"
  | "pdf"
  | "presentations"
  | "spreadsheets"
  | "videos";

/** Map mime / name / coarse kind → `/public/types/*.svg`. */
export function fileTypeIconName(
  kind?: FileItem["kind"] | null,
  mimeType?: string | null,
  fileName?: string | null,
): FileTypeIconName {
  const mime = (mimeType ?? "").toLowerCase();
  const name = (fileName ?? "").toLowerCase();
  const ext = name.includes(".") ? (name.split(".").pop() ?? "") : "";

  if (kind === "shortcut" || mime.includes("shortcut")) {
    return "documents";
  }

  if (
    kind === "image" ||
    mime.startsWith("image/") ||
    /^(heic|heif|jpe?g|png|gif|webp|bmp|svg|tiff?|avif|ico)$/i.test(ext)
  ) {
    return "images";
  }
  if (
    kind === "video" ||
    mime.startsWith("video/") ||
    /^(mp4|mov|avi|mkv|webm|m4v|3gp|mpeg|mpg|wmv|flv)$/i.test(ext)
  ) {
    return "videos";
  }
  if (
    mime.startsWith("audio/") ||
    /^(mp3|wav|flac|aac|m4a|ogg|wma|aiff?|opus)$/i.test(ext)
  ) {
    return "audio";
  }
  if (kind === "pdf" || mime.includes("pdf") || ext === "pdf") {
    return "pdf";
  }
  if (
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    mime === "text/csv" ||
    mime.includes("csv") ||
    /^(xlsx?|xls|csv|ods|tsv)$/i.test(ext)
  ) {
    return "spreadsheets";
  }
  if (
    mime.includes("presentation") ||
    mime.includes("powerpoint") ||
    /^(pptx?|ppt|odp|key)$/i.test(ext)
  ) {
    return "presentations";
  }
  if (
    mime.includes("markdown") ||
    ext === "md" ||
    ext === "markdown" ||
    ext === "mdx"
  ) {
    return "markdown";
  }
  if (
    mime.includes("zip") ||
    mime.includes("x-tar") ||
    mime.includes("x-rar") ||
    mime.includes("x-7z") ||
    mime.includes("gzip") ||
    mime.includes("compressed") ||
    /^(zip|rar|7z|tar|gz|tgz|bz2|xz)$/i.test(ext)
  ) {
    return "archives";
  }
  if (
    mime.includes("form") ||
    mime === "application/vnd.google-apps.form" ||
    ext === "gform"
  ) {
    return "forms";
  }
  return "documents";
}

export function fileTypeIconSrc(
  kind?: FileItem["kind"] | null,
  mimeType?: string | null,
  fileName?: string | null,
) {
  return `/types/${fileTypeIconName(kind, mimeType, fileName)}.svg`;
}

export function FileIcon({
  kind,
  mimeType,
  fileName,
  className,
  alt = "",
}: {
  kind?: FileItem["kind"] | null;
  mimeType?: string | null;
  fileName?: string | null;
  className?: string;
  alt?: string;
}) {
  return (
    // biome-ignore lint/performance/noImgElement: static public SVG asset
    <img
      src={fileTypeIconSrc(kind, mimeType, fileName)}
      alt={alt}
      draggable={false}
      className={cn("h-5 w-5 object-contain", className)}
    />
  );
}
