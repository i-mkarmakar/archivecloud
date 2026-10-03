import "server-only";

import { getPlanById } from "@/lib/plans";
import { env } from "@/server/config/env";
import { prisma } from "@/server/config/prisma";
import { errorJson } from "@/server/http/responses";
import { getUserPlanId } from "@/server/modules/billing/plan-gate";

/** Batch DB writes — not per chunk. */
export const SHARE_BANDWIDTH_BATCH_BYTES = 1_048_576; // 1 MiB

/** Keep ~40 days of daily rows. */
export const SHARE_BANDWIDTH_RETENTION_DAYS = 40;

export function utcDayStart(date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function secondsUntilNextUtcMidnight(date = new Date()): number {
  const next = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1,
  );
  return Math.max(1, Math.ceil((next - date.getTime()) / 1000));
}

function resolveDailyUserLimit(planLimit: bigint | null): bigint | null {
  if (env.SHARE_BANDWIDTH_DAILY_BYTES != null) {
    return BigInt(env.SHARE_BANDWIDTH_DAILY_BYTES);
  }
  return planLimit;
}

function resolveDailyLinkLimit(planLimit: bigint | null): bigint | null {
  if (env.SHARE_BANDWIDTH_DAILY_LINK_BYTES != null) {
    return BigInt(env.SHARE_BANDWIDTH_DAILY_LINK_BYTES);
  }
  return planLimit;
}

export async function getShareBandwidthUsage(params: {
  userId: string;
  shareId: string;
  day?: Date;
}) {
  const day = utcDayStart(params.day);
  const planId = await getUserPlanId(params.userId);
  const plan = getPlanById(planId);
  const userLimit = resolveDailyUserLimit(plan.limits.dailyShareBandwidthBytes);
  const linkLimit = resolveDailyLinkLimit(
    plan.limits.dailyShareLinkBandwidthBytes,
  );

  const [linkRow, userAgg] = await Promise.all([
    prisma.shareBandwidthDaily.findUnique({
      where: {
        shareId_day: { shareId: params.shareId, day },
      },
      select: { bytesSent: true },
    }),
    prisma.shareBandwidthDaily.aggregate({
      where: { userId: params.userId, day },
      _sum: { bytesSent: true },
    }),
  ]);

  const linkBytes = linkRow?.bytesSent ?? 0n;
  const userBytes = userAgg._sum.bytesSent ?? 0n;
  const linkRemaining =
    linkLimit == null
      ? null
      : linkBytes >= linkLimit
        ? 0n
        : linkLimit - linkBytes;
  const userRemaining =
    userLimit == null
      ? null
      : userBytes >= userLimit
        ? 0n
        : userLimit - userBytes;

  let remainingBudget: bigint | null = null;
  if (linkRemaining != null && userRemaining != null) {
    remainingBudget =
      linkRemaining < userRemaining ? linkRemaining : userRemaining;
  } else if (linkRemaining != null) {
    remainingBudget = linkRemaining;
  } else if (userRemaining != null) {
    remainingBudget = userRemaining;
  }

  return {
    day,
    planId,
    linkBytes,
    userBytes,
    userLimit,
    linkLimit,
    remainingBudget,
  };
}

function bandwidthLimitResponse(message: string) {
  return errorJson("SHARE_BANDWIDTH_LIMIT", message, 429, {
    headers: { "Retry-After": String(secondsUntilNextUtcMidnight()) },
  });
}

export async function assertShareBandwidthCapacity(params: {
  userId: string;
  shareId: string;
}): Promise<Response | null> {
  const usage = await getShareBandwidthUsage(params);
  if (usage.remainingBudget != null && usage.remainingBudget <= 0n) {
    if (usage.linkLimit != null && usage.linkBytes >= usage.linkLimit) {
      return bandwidthLimitResponse(
        "This public link has reached its daily bandwidth limit. Try again tomorrow.",
      );
    }
    return bandwidthLimitResponse(
      "Daily public share bandwidth limit reached. Try again tomorrow.",
    );
  }
  return null;
}

export async function recordShareBandwidth(params: {
  userId: string;
  shareId: string;
  bytes: bigint;
  day?: Date;
}) {
  if (params.bytes <= 0n) return;
  const day = utcDayStart(params.day);
  await prisma.shareBandwidthDaily.upsert({
    where: {
      shareId_day: { shareId: params.shareId, day },
    },
    create: {
      userId: params.userId,
      shareId: params.shareId,
      day,
      bytesSent: params.bytes,
    },
    update: {
      bytesSent: { increment: params.bytes },
    },
  });
}

export async function pruneShareBandwidthDaily(params?: {
  olderThanDays?: number;
  now?: Date;
}) {
  const days = params?.olderThanDays ?? SHARE_BANDWIDTH_RETENTION_DAYS;
  const cutoff = utcDayStart(params?.now);
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const result = await prisma.shareBandwidthDaily.deleteMany({
    where: { day: { lt: cutoff } },
  });
  return { deleted: result.count, cutoff };
}

type MeterCallbacks = {
  onBatch: (bytes: bigint) => void | Promise<void>;
  batchBytes?: number;
  /** When set, stop the stream once this many bytes have been enqueued. */
  remainingBudget?: bigint | null;
};

/** Count streamed bytes; flush in batches (and on close/cancel), not per chunk. */
export function meterReadableStream(
  source: ReadableStream<Uint8Array>,
  callbacks: MeterCallbacks,
): ReadableStream<Uint8Array> {
  const batchBytes = callbacks.batchBytes ?? SHARE_BANDWIDTH_BATCH_BYTES;
  let pending = 0;
  let allowed =
    callbacks.remainingBudget == null
      ? null
      : callbacks.remainingBudget < 0n
        ? 0n
        : callbacks.remainingBudget;
  const reader = source.getReader();

  const flush = async (force = false) => {
    if (pending <= 0) return;
    if (!force && pending < batchBytes) return;
    const n = BigInt(pending);
    pending = 0;
    await callbacks.onBatch(n);
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          await flush(true);
          controller.close();
          return;
        }

        let bytes = value;
        if (allowed != null) {
          if (allowed <= 0n) {
            await flush(true);
            controller.error(
              new Error("SHARE_BANDWIDTH_LIMIT: daily bandwidth exhausted"),
            );
            await reader.cancel().catch(() => undefined);
            return;
          }
          if (BigInt(bytes.byteLength) > allowed) {
            bytes = bytes.subarray(0, Number(allowed));
            allowed = 0n;
            pending += bytes.byteLength;
            controller.enqueue(bytes);
            await flush(true);
            controller.error(
              new Error("SHARE_BANDWIDTH_LIMIT: daily bandwidth exhausted"),
            );
            await reader.cancel().catch(() => undefined);
            return;
          }
          allowed -= BigInt(bytes.byteLength);
        }

        pending += bytes.byteLength;
        controller.enqueue(bytes);
        if (pending >= batchBytes) {
          await flush(true);
        }
      } catch (error) {
        await flush(true);
        controller.error(error);
      }
    },
    async cancel() {
      await flush(true);
      await reader.cancel().catch(() => undefined);
    },
  });
}

export async function meterShareBandwidthResponse(
  response: Response,
  params: { userId: string; shareId: string },
): Promise<Response> {
  if (!response.ok || !response.body) return response;

  const usage = await getShareBandwidthUsage(params);
  const body = meterReadableStream(response.body, {
    remainingBudget: usage.remainingBudget,
    onBatch: (bytes) =>
      recordShareBandwidth({
        userId: params.userId,
        shareId: params.shareId,
        bytes,
      }).catch((error) => {
        console.error("Share bandwidth record failed:", error);
      }),
  });

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
