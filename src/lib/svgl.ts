import type { SvglSvg, ThemeOptions } from "@/types/svgl";

const SVGL_API_BASE = "https://api.svgl.app";
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Known fallback when SVGL API is unavailable. */
export const GOOGLE_DRIVE_LOGO_FALLBACK = "https://svgl.app/library/drive.svg";

type CacheEntry = {
  value: SvglSvg | null;
  expiresAt: number;
};

const memoryCache = new Map<string, CacheEntry>();

export function resolveSvglRoute(
  route: string | ThemeOptions,
  theme: "light" | "dark" = "light",
): string {
  if (typeof route === "string") return route;
  return theme === "dark" ? route.dark : route.light;
}

export function resolveSvglLogoSrc(
  svg: Pick<SvglSvg, "route"> | null | undefined,
  theme: "light" | "dark" = "light",
): string | null {
  if (!svg) return null;
  return resolveSvglRoute(svg.route, theme);
}

function getCached(search: string): SvglSvg | null | undefined {
  const entry = memoryCache.get(search.toLowerCase());
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(search.toLowerCase());
    return undefined;
  }
  return entry.value;
}

function setCached(search: string, value: SvglSvg | null) {
  memoryCache.set(search.toLowerCase(), {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export async function fetchSvglBySearch(
  search: string,
): Promise<SvglSvg | null> {
  const cacheKey = search.trim().toLowerCase();
  const cached = getCached(cacheKey);
  if (cached !== undefined) return cached;

  const response = await fetch(
    `${SVGL_API_BASE}?search=${encodeURIComponent(search.trim())}`,
    { next: { revalidate: 300 } },
  );

  if (!response.ok) {
    setCached(cacheKey, null);
    return null;
  }

  const data = (await response.json()) as SvglSvg[];
  const match =
    data.find((item) => item.title.trim().toLowerCase() === cacheKey) ??
    data[0] ??
    null;

  setCached(cacheKey, match);
  return match;
}

export async function fetchGoogleDriveLogoSrc(
  theme: "light" | "dark" = "light",
): Promise<string> {
  const svg = await fetchSvglBySearch("Google Drive");
  return resolveSvglLogoSrc(svg, theme) ?? GOOGLE_DRIVE_LOGO_FALLBACK;
}
