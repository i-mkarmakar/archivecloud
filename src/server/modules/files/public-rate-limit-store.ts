import "server-only";

import { prisma } from "@/server/config/prisma";

export type RateLimitHitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

export type PublicShareRateLimitStore = {
  hit(params: {
    key: string;
    limit: number;
    windowMs: number;
    now: number;
  }): Promise<RateLimitHitResult>;
};

export function fixedWindowStartMs(now: number, windowMs: number) {
  return Math.floor(now / windowMs) * windowMs;
}

/**
 * In-memory fixed-window store for unit tests and multi-instance simulation
 * (share one store instance across simulated replicas).
 */
export class MemoryPublicShareRateLimitStore
  implements PublicShareRateLimitStore
{
  private readonly buckets = new Map<
    string,
    { windowStart: number; count: number }
  >();
  private readonly keyTails = new Map<string, Promise<void>>();

  async hit(params: {
    key: string;
    limit: number;
    windowMs: number;
    now: number;
  }): Promise<RateLimitHitResult> {
    const prev = this.keyTails.get(params.key) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.keyTails.set(
      params.key,
      prev.then(
        () => gate,
        () => gate,
      ),
    );
    await prev.catch(() => undefined);

    try {
      const start = fixedWindowStartMs(params.now, params.windowMs);
      let bucket = this.buckets.get(params.key);
      if (!bucket || bucket.windowStart !== start) {
        bucket = { windowStart: start, count: 0 };
        this.buckets.set(params.key, bucket);
      }
      if (bucket.count >= params.limit) {
        return {
          ok: false,
          retryAfterSec: Math.max(
            1,
            Math.ceil(
              (bucket.windowStart + params.windowMs - params.now) / 1000,
            ),
          ),
        };
      }
      bucket.count += 1;
      return { ok: true };
    } finally {
      release();
    }
  }

  clear() {
    this.buckets.clear();
    this.keyTails.clear();
  }
}

/**
 * Postgres fixed-window counters — one atomic UPSERT per hit, shared by all replicas.
 */
export class PostgresPublicShareRateLimitStore
  implements PublicShareRateLimitStore
{
  async hit(params: {
    key: string;
    limit: number;
    windowMs: number;
    now: number;
  }): Promise<RateLimitHitResult> {
    const start = new Date(fixedWindowStartMs(params.now, params.windowMs));
    const rows = await prisma.$queryRaw<
      Array<{ count: number; window_start: Date }>
    >`
      INSERT INTO public_share_rate_buckets (bucket_key, window_start, count, updated_at)
      VALUES (${params.key}, ${start}, 1, NOW())
      ON CONFLICT (bucket_key) DO UPDATE SET
        count = CASE
          WHEN public_share_rate_buckets.window_start = EXCLUDED.window_start
            THEN public_share_rate_buckets.count + 1
          ELSE 1
        END,
        window_start = CASE
          WHEN public_share_rate_buckets.window_start = EXCLUDED.window_start
            THEN public_share_rate_buckets.window_start
          ELSE EXCLUDED.window_start
        END,
        updated_at = NOW()
      RETURNING count, window_start
    `;

    const row = rows[0];
    if (!row) {
      throw new Error("Rate limit upsert returned no row.");
    }
    if (row.count > params.limit) {
      const windowStart = new Date(row.window_start).getTime();
      return {
        ok: false,
        retryAfterSec: Math.max(
          1,
          Math.ceil((windowStart + params.windowMs - params.now) / 1000),
        ),
      };
    }
    return { ok: true };
  }
}

export const memoryPublicShareRateLimitStore =
  new MemoryPublicShareRateLimitStore();
export const postgresPublicShareRateLimitStore =
  new PostgresPublicShareRateLimitStore();
