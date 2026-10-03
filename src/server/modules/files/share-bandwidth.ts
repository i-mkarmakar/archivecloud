import "server-only";

import { getPlanById } from "@/lib/plans";
import { env } from "@/server/config/env";
import { prisma } from "@/server/config/prisma";
import { errorJson } from "@/server/http/responses";
import { getUserPlanId } from "@/server/modules/billing/plan-gate";

/** Batch DB writes — not per chunk. */
export const SHARE_BANDWIDTH_BATCH_BYTES = 1_048_576; // 1 MiB

export function utcDayStart(date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
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

  return {
    day,
    planId,
    linkBytes,
    userBytes,
    userLimit,
    linkLimit,
  };
}

export async function assertShareBandwidthCapacity(params: {
  userId: string;
  shareId: string;
}): Promise<Response | null> {
  const usage = await getShareBandwidthUsage(params);
  if (usage.linkLimit != null && usage.linkBytes >= usage.linkLimit) {
    return errorJson(
      "SHARE_BANDWIDTH_LIMIT",
      "This public link has reached its daily bandwidth limit. Try again tomorrow.",
      429,
      { headers: { "Retry-After": "3600" } },
    );
  }
  if (usage.userLimit != null && usage.userBytes >= usage.userLimit) {
    return errorJson(
      "SHARE_BANDWIDTH_LIMIT",
      "Daily public share bandwidth limit reached. Try again tomorrow.",
      429,
      { headers: { "Retry-After": "3600" } },
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

type MeterCallbacks = {
  onBatch: (bytes: bigint) => void | Promise<void>;
  batchBytes?: number;
};

/** Count streamed bytes; flush in batches (and on close/error), not per chunk. */
export function meterReadableStream(
  source: ReadableStream<Uint8Array>,
  callbacks: MeterCallbacks,
): ReadableStream<Uint8Array> {
  const batchBytes = callbacks.batchBytes ?? SHARE_BANDWIDTH_BATCH_BYTES;
  let pending = 0;

  const flush = async (force = false) => {
    if (pending <= 0) return;
    if (!force && pending < batchBytes) return;
    const n = BigInt(pending);
    pending = 0;
    await callbacks.onBatch(n);
  };

  return source.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      async transform(chunk, controller) {
        pending += chunk.byteLength;
        controller.enqueue(chunk);
        if (pending >= batchBytes) {
          await flush(true);
        }
      },
      async flush() {
        await flush(true);
      },
    }),
  );
}

export function meterShareBandwidthResponse(
  response: Response,
  params: { userId: string; shareId: string },
): Response {
  if (!response.ok || !response.body) return response;

  const body = meterReadableStream(response.body, {
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
