/**
 * Safety headers + disposition policy for proxied public/preview byte responses.
 * Never trust provider Content-Type alone for inline vs attachment — check allowlist.
 */

const PUBLIC_BYTE_CSP =
  "default-src 'none'; sandbox; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

/** Exact types allowed for Content-Disposition: inline. */
const INLINE_EXACT = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/bmp",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

/** Prefixes allowed for inline (SVG excluded — never image/svg+xml). */
const INLINE_PREFIXES = ["audio/", "video/"] as const;

export function normalizeMimeType(mimeType: string | null | undefined): string {
  const base = (mimeType ?? "application/octet-stream")
    .split(";")[0]
    ?.trim()
    .toLowerCase();
  return base && base.length > 0 ? base : "application/octet-stream";
}

export function isInlineAllowedMime(
  mimeType: string | null | undefined,
): boolean {
  const mime = normalizeMimeType(mimeType);
  if (mime === "image/svg+xml" || mime === "text/html") return false;
  if (INLINE_EXACT.has(mime)) return true;
  return INLINE_PREFIXES.some((prefix) => mime.startsWith(prefix));
}

export function resolvePublicContentDisposition(
  preferred: "inline" | "attachment" | undefined,
  mimeType: string | null | undefined,
): "inline" | "attachment" {
  if (preferred === "inline" && isInlineAllowedMime(mimeType)) {
    return "inline";
  }
  return "attachment";
}

function contentDispositionHeader(
  type: "inline" | "attachment",
  fileName: string,
): string {
  return `${type}; filename="${fileName.replaceAll('"', "")}"`;
}

/** Apply nosniff, restrictive CSP, and disposition (allowlist-gated). */
export function applyPublicByteSafetyHeaders(
  headers: Headers,
  params: {
    mimeType: string | null | undefined;
    fileName: string;
    preferredDisposition?: "inline" | "attachment";
  },
): void {
  const mime = normalizeMimeType(params.mimeType);
  headers.set("Content-Type", mime);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Security-Policy", PUBLIC_BYTE_CSP);
  const disposition = resolvePublicContentDisposition(
    params.preferredDisposition,
    mime,
  );
  headers.set(
    "Content-Disposition",
    contentDispositionHeader(disposition, params.fileName),
  );
}
