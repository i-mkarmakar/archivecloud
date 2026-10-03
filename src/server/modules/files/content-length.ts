/** Prefer provider Content-Length; fall back to catalog/metadata size. */
export function resolveContentLengthHeader(params: {
  providerContentLength?: string | null;
  sizeBytes?: bigint | null;
}): string | null {
  if (params.providerContentLength) return params.providerContentLength;
  if (params.sizeBytes != null && params.sizeBytes > 0n) {
    return params.sizeBytes.toString();
  }
  return null;
}

export function applyContentLengthHeader(
  headers: Headers,
  params: {
    providerContentLength?: string | null;
    sizeBytes?: bigint | null;
  },
): void {
  const value = resolveContentLengthHeader(params);
  if (value) headers.set("Content-Length", value);
}
