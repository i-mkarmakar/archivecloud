import "server-only";

import { createHash } from "node:crypto";
import { env } from "@/server/config/env";
import { errorJson } from "@/server/http/responses";
import {
  memoryPublicShareRateLimitStore,
  postgresPublicShareRateLimitStore,
  type PublicShareRateLimitStore,
} from "@/server/modules/files/public-rate-limit-store";

/** Test / multi-instance simulation seam. Null → Postgres (production default). */
let storeOverride: PublicShareRateLimitStore | null = null;

export function setPublicShareRateLimitStoreForTests(
  store: PublicShareRateLimitStore | null,
) {
  storeOverride = store;
}

export function resetPublicShareRateLimitForTests() {
  memoryPublicShareRateLimitStore.clear();
  storeOverride = memoryPublicShareRateLimitStore;
}

function getStore(): PublicShareRateLimitStore {
  return storeOverride ?? postgresPublicShareRateLimitStore;
}

function hashTokenKey(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Accept IPv4 / IPv6-ish values only; reject header junk used for key injection. */
export function normalizeClientIp(value: string): string | null {
  const v = value.trim();
  if (!v || v.length > 64) return null;
  if (v.includes("/") || v.includes(" ") || v.includes("%")) return null;

  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(v)) {
    const parts = v.split(".").map(Number);
    if (parts.every((n) => n >= 0 && n <= 255)) return v;
    return null;
  }

  // Compact IPv6 (includes ::). Not a full RFC parser — rejects obvious garbage.
  if (/^[0-9a-fA-F:]+$/.test(v) && v.includes(":")) {
    return v.toLowerCase();
  }

  return null;
}

/**
 * Client IP for rate limiting.
 * Uses the first X-Forwarded-For hop when present (deployment must set a trusted proxy).
 * Falls back to X-Real-IP, then "unknown". Does not use User-Agent / Referer / Origin.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim() ?? "";
    const normalized = normalizeClientIp(first);
    if (normalized) return normalized;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    const normalized = normalizeClientIp(realIp);
    if (normalized) return normalized;
  }
  return "unknown";
}

function rateLimitedResponse(retryAfterSec: number, message: string) {
  return errorJson("RATE_LIMITED", message, 429, {
    headers: { "Retry-After": String(retryAfterSec) },
  });
}

/**
 * Returns a 429 Response when limited; otherwise null.
 * Shared across replicas via Postgres (or an injected store in tests).
 * On datastore failure: fail closed with 503 (no internal error details).
 */
export async function enforcePublicShareRateLimit(params: {
  request: Request;
  token: string;
}): Promise<Response | null> {
  const now = Date.now();
  const windowMs = env.PUBLIC_SHARE_RATE_WINDOW_MS;
  const ip = getClientIp(params.request);
  const store = getStore();

  try {
    const ipHit = await store.hit({
      key: `ip:${ip}`,
      limit: env.PUBLIC_SHARE_RATE_LIMIT_PER_IP,
      windowMs,
      now,
    });
    if (!ipHit.ok) {
      return rateLimitedResponse(
        ipHit.retryAfterSec,
        "Too many requests. Try again later.",
      );
    }

    const tokenHit = await store.hit({
      key: `tok:${hashTokenKey(params.token)}`,
      limit: env.PUBLIC_SHARE_RATE_LIMIT_PER_TOKEN,
      windowMs,
      now,
    });
    if (!tokenHit.ok) {
      return rateLimitedResponse(
        tokenHit.retryAfterSec,
        "Too many requests for this link. Try again later.",
      );
    }

    return null;
  } catch (error) {
    console.error("[public-share-rate-limit]", {
      name: error instanceof Error ? error.name : "Error",
      message: error instanceof Error ? error.message : String(error),
    });
    // Fail closed: public share abuse path must not open when the store is down.
    return errorJson(
      "RATE_LIMITED",
      "Too many requests. Try again later.",
      503,
      { headers: { "Retry-After": "30" } },
    );
  }
}
