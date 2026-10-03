const LOCALE_PREFIX =
  /^\/(en|fr|de|es|pt|it|ja|zh|ko|nl|pl|ru|ar|hi|tr|sv|da|fi|no|cs|ro|uk|vi|th|id|ms)(?=\/|$)/i;

/** Auth entry / alias paths that must never be post-login destinations. */
const AUTH_ENTRY_PATHS = new Set([
  "/login",
  "/signin",
  "/signup",
  "/verify-email",
  "/google-auth",
]);

export function normalizeAppPath(pathname: string): string {
  let path = pathname.trim();
  if (!path.startsWith("/") || path.startsWith("//")) {
    return "/home";
  }

  const withoutLocale = path.replace(LOCALE_PREFIX, "");
  path = withoutLocale === "" ? "/" : withoutLocale;

  if (!path.startsWith("/") || path.startsWith("//")) {
    return "/home";
  }

  return path;
}

export function isAuthEntryPath(pathname: string): boolean {
  const path = normalizeAppPath(pathname);
  if (AUTH_ENTRY_PATHS.has(path)) return true;
  return path === "/auth" || path.startsWith("/auth/");
}

/**
 * Resolve a same-origin app path for post-login redirects.
 * Rejects absolute URLs, protocol-relative URLs, and auth entry aliases
 * so `/login` (etc.) can never become the successful-login destination.
 */
export function safeCallbackUrl(
  raw: string | null | undefined,
  fallback = "/home",
): string {
  if (!raw) return fallback;

  if (raw.includes("://") || raw.startsWith("//") || !raw.startsWith("/")) {
    return fallback;
  }

  const normalized = normalizeAppPath(raw);
  if (normalized === "/" || isAuthEntryPath(normalized)) {
    return fallback;
  }

  return normalized;
}
