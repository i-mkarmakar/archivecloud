import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const envState = vi.hoisted(() => ({
  SHARE_BANDWIDTH_DAILY_BYTES: undefined as number | undefined,
  SHARE_BANDWIDTH_DAILY_LINK_BYTES: undefined as number | undefined,
}));

vi.mock("@/server/config/env", () => ({
  env: envState,
}));

const prismaMock = vi.hoisted(() => ({
  shareBandwidthDaily: {
    findUnique: vi.fn(),
    aggregate: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock("@/server/config/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/server/modules/billing/plan-gate", () => ({
  getUserPlanId: vi.fn(async () => "free"),
}));

import {
  assertShareBandwidthCapacity,
  meterReadableStream,
  recordShareBandwidth,
  SHARE_BANDWIDTH_BATCH_BYTES,
  utcDayStart,
} from "@/server/modules/files/share-bandwidth";

describe("utcDayStart", () => {
  it("floors to UTC midnight", () => {
    const d = utcDayStart(new Date("2026-10-03T15:30:00.000Z"));
    expect(d.toISOString()).toBe("2026-10-03T00:00:00.000Z");
  });
});

describe("assertShareBandwidthCapacity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envState.SHARE_BANDWIDTH_DAILY_BYTES = undefined;
    envState.SHARE_BANDWIDTH_DAILY_LINK_BYTES = undefined;
    prismaMock.shareBandwidthDaily.findUnique.mockResolvedValue({
      bytesSent: 0n,
    });
    prismaMock.shareBandwidthDaily.aggregate.mockResolvedValue({
      _sum: { bytesSent: 0n },
    });
  });

  it("allows under plan caps", async () => {
    expect(
      await assertShareBandwidthCapacity({
        userId: "u1",
        shareId: "s1",
      }),
    ).toBeNull();
  });

  it("429s when per-link daily cap is reached", async () => {
    envState.SHARE_BANDWIDTH_DAILY_LINK_BYTES = 100;
    prismaMock.shareBandwidthDaily.findUnique.mockResolvedValue({
      bytesSent: 100n,
    });
    const res = await assertShareBandwidthCapacity({
      userId: "u1",
      shareId: "s1",
    });
    expect(res?.status).toBe(429);
    const retryAfter = Number(res?.headers.get("Retry-After"));
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(86_400);
    const body = await res?.json();
    expect(body.code).toBe("SHARE_BANDWIDTH_LIMIT");
  });

  it("429s when per-user daily cap is reached", async () => {
    envState.SHARE_BANDWIDTH_DAILY_BYTES = 200;
    prismaMock.shareBandwidthDaily.aggregate.mockResolvedValue({
      _sum: { bytesSent: 200n },
    });
    const res = await assertShareBandwidthCapacity({
      userId: "u1",
      shareId: "s1",
    });
    expect(res?.status).toBe(429);
  });
});

describe("recordShareBandwidth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.shareBandwidthDaily.upsert.mockResolvedValue({});
  });

  it("upserts increment for positive bytes", async () => {
    await recordShareBandwidth({
      userId: "u1",
      shareId: "s1",
      bytes: 42n,
      day: new Date("2026-10-03T12:00:00Z"),
    });
    expect(prismaMock.shareBandwidthDaily.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: "u1",
          shareId: "s1",
          bytesSent: 42n,
        }),
        update: { bytesSent: { increment: 42n } },
      }),
    );
  });

  it("skips zero bytes", async () => {
    await recordShareBandwidth({
      userId: "u1",
      shareId: "s1",
      bytes: 0n,
    });
    expect(prismaMock.shareBandwidthDaily.upsert).not.toHaveBeenCalled();
  });
});

describe("meterReadableStream", () => {
  it("batches writes and flushes remainder on close", async () => {
    const batches: bigint[] = [];
    const chunk = new Uint8Array(SHARE_BANDWIDTH_BATCH_BYTES / 2);
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(chunk);
        controller.enqueue(chunk);
        controller.enqueue(new Uint8Array(10));
        controller.close();
      },
    });

    const metered = meterReadableStream(source, {
      batchBytes: SHARE_BANDWIDTH_BATCH_BYTES,
      onBatch: (n) => {
        batches.push(n);
      },
    });

    const reader = metered.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    expect(batches).toEqual([BigInt(SHARE_BANDWIDTH_BATCH_BYTES), 10n]);
  });

  it("cuts mid-stream when remainingBudget is exhausted", async () => {
    const batches: bigint[] = [];
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(8));
        controller.enqueue(new Uint8Array(8));
        controller.close();
      },
    });

    const metered = meterReadableStream(source, {
      batchBytes: 100,
      remainingBudget: 10n,
      onBatch: (n) => {
        batches.push(n);
      },
    });

    const reader = metered.getReader();
    const first = await reader.read();
    expect(first.value?.byteLength).toBe(8);
    const second = await reader.read();
    expect(second.value?.byteLength).toBe(2);
    await expect(reader.read()).rejects.toThrow(/SHARE_BANDWIDTH_LIMIT/);
    expect(batches).toEqual([10n]);
  });

  it("flushes pending bytes on cancel", async () => {
    const batches: bigint[] = [];
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(20));
      },
    });

    const metered = meterReadableStream(source, {
      batchBytes: 1000,
      onBatch: (n) => {
        batches.push(n);
      },
    });

    const reader = metered.getReader();
    await reader.read();
    await reader.cancel();
    expect(batches).toEqual([20n]);
  });
});
