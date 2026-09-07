/**
 * Profile image resolution:
 * 1. Custom upload or Google OAuth / synced picture (`user.image`)
 * 2. Empty string → UI shows initials until Google sync fills `user.image`
 *
 * Google photo URLs often ship as tiny thumbs (`=s96-c`). Upgrade size for crisp display.
 */
export function getProfileImageUrl({
  image,
  size = 512,
}: {
  image?: string | null;
  email?: string | null;
  size?: number;
}): string {
  const custom = image?.trim();
  if (!custom) return "";
  return upgradeProfileImageUrl(custom, size);
}

/** Request a sharper Google (and similar CDN) avatar URL. */
export function upgradeProfileImageUrl(url: string, size = 512): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;

  try {
    if (
      trimmed.includes("googleusercontent.com") ||
      trimmed.includes("ggpht.com")
    ) {
      let next = trimmed.replace(/=s\d+(-[a-z]+)?/gi, `=s${size}$1`);
      next = next.replace(/\/s\d+(-[a-z]+)?\//gi, `/s${size}$1/`);
      if (next === trimmed && !/=s\d+/i.test(trimmed)) {
        next = `${trimmed}${trimmed.includes("?") ? "&" : "="}s${size}-c`;
      }
      return next;
    }

    const parsed = new URL(trimmed);
    if (parsed.searchParams.has("sz")) {
      parsed.searchParams.set("sz", String(size));
      return parsed.toString();
    }
    if (parsed.searchParams.has("s")) {
      parsed.searchParams.set("s", String(size));
      return parsed.toString();
    }
    if (parsed.searchParams.has("size")) {
      parsed.searchParams.set("size", String(size));
      return parsed.toString();
    }
  } catch {
    // data URLs / invalid URLs — return as-is
  }

  return trimmed;
}

/** @deprecated Prefer getProfileImageUrl */
export async function getGravatarUrl(email: string | undefined, size: number) {
  return getProfileImageUrl({ email, size });
}
