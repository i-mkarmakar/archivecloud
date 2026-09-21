const LOCALE_PREFIX =
  /^\/(en|fr|de|es|pt|it|ja|zh|ko|nl|pl|ru|ar|hi|tr|sv|da|fi|no|cs|ro|uk|vi|th|id|ms)(?=\/|$)/i;

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

export function safeCallbackUrl(
  raw: string | null | undefined,
  fallback = "/home",
): string {
  if (!raw) return fallback;

  if (raw.includes("://") || raw.startsWith("//") || !raw.startsWith("/")) {
    return fallback;
  }

  const normalized = normalizeAppPath(raw);
  return normalized === "/" ? fallback : normalized;
}
