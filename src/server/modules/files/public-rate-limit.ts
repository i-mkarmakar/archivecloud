import "server-only";

import { env } from "@/server/config/env";
import { errorJson } from "@/server/http/responses";

/**
 * In-process sliding-window limiter for public share routes.
 * # ponytail: process-local Map — multi-instance deployments do not share counters;
 * switch to Redis/Upstash when horizontal scale needs a global limit.
 */
type WindowEntry = { timestamps: number[] };

const ipWindows = new Map<string, WindowEntry>();
const tokenWindows = new Map<string, WindowEntry>();

function prune(entry: WindowEntry, windowMs: number, now: number) {
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
}

function hit(
  map: Map<string, WindowEntry>,
  key: string,
  limit: number,
  windowMs: number,
  now: number,
): { ok: true } | { ok: false; retryAfterSec: number } {
  let entry = map.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    map.set(key, entry);
  }
  prune(entry, windowMs, now);
  if (entry.timestamps.length >= limit) {
    const oldest = entry.timestamps[0] ?? now;
    const retryAfterSec = Math.max(
      1,
      Math.ceil((oldest + windowMs - now) / 1000),
    );
    return { ok: false, retryAfterSec };
  }
  entry.timestamps.push(now);
  return { ok: true };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

/** Returns a 429 Response when limited; otherwise null. */
export function enforcePublicShareRateLimit(params: {
  request: Request;
  token: string;
}): Response | null {
  const now = Date.now();
  const windowMs = env.PUBLIC_SHARE_RATE_WINDOW_MS;
  const ip = getClientIp(params.request);

  const ipHit = hit(
    ipWindows,
    ip,
    env.PUBLIC_SHARE_RATE_LIMIT_PER_IP,
    windowMs,
    now,
  );
  if (!ipHit.ok) {
    return errorJson(
      "RATE_LIMITED",
      "Too many requests. Try again later.",
      429,
      { headers: { "Retry-After": String(ipHit.retryAfterSec) } },
    );
  }

  const tokenHit = hit(
    tokenWindows,
    params.token,
    env.PUBLIC_SHARE_RATE_LIMIT_PER_TOKEN,
    windowMs,
    now,
  );
  if (!tokenHit.ok) {
    return errorJson(
      "RATE_LIMITED",
      "Too many requests for this link. Try again later.",
      429,
      { headers: { "Retry-After": String(tokenHit.retryAfterSec) } },
    );
  }

  return null;
}

/** Test seam. */
export function resetPublicShareRateLimitForTests() {
  ipWindows.clear();
  tokenWindows.clear();
}
