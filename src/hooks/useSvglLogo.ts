"use client";

import { useEffect, useState } from "react";
import { GOOGLE_DRIVE_LOGO_FALLBACK } from "@/lib/svgl";
import { apiFetch } from "@/lib/api";

const clientCache = new Map<string, { src: string; expiresAt: number }>();

const CACHE_TTL_MS = 5 * 60 * 1000;

function readClientCache(key: string): string | undefined {
  const entry = clientCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    clientCache.delete(key);
    return undefined;
  }
  return entry.src;
}

function writeClientCache(key: string, src: string) {
  clientCache.set(key, { src, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function useSvglLogo(
  search: string,
  options?: { theme?: "light" | "dark"; fallback?: string },
) {
  const theme = options?.theme ?? "light";
  const fallback =
    options?.fallback ??
    (search.trim().toLowerCase() === "google drive"
      ? GOOGLE_DRIVE_LOGO_FALLBACK
      : undefined);
  const cacheKey = `${search.trim().toLowerCase()}:${theme}`;

  const [src, setSrc] = useState<string | undefined>(
    () => readClientCache(cacheKey) ?? fallback,
  );

  useEffect(() => {
    const cached = readClientCache(cacheKey);
    if (cached) {
      setSrc(cached);
      return;
    }

    let cancelled = false;

    apiFetch<{ src: string }>(
      `/svgl?search=${encodeURIComponent(search.trim())}&theme=${theme}`,
    )
      .then((data) => {
        if (cancelled) return;
        writeClientCache(cacheKey, data.src);
        setSrc(data.src);
      })
      .catch(() => {
        if (cancelled || !fallback) return;
        writeClientCache(cacheKey, fallback);
        setSrc(fallback);
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, fallback, search, theme]);

  return src;
}
