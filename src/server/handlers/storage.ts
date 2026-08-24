import { z } from "zod";
import { prisma } from "@/server/config/prisma";
import { requireAuthUser } from "@/server/http/auth";
import { json } from "@/server/http/responses";
import { requirePlanFeature } from "@/server/modules/billing/plan-gate";
import {
  syncGoogleDriveBreakdown,
  syncGoogleQuota,
} from "@/server/modules/google/google.service";

const breakdownStaleMs = 60 * 60 * 1000;

function isBreakdownStale(breakdownSyncedAt: Date | null | undefined) {
  if (!breakdownSyncedAt) return true;
  return Date.now() - breakdownSyncedAt.getTime() > breakdownStaleMs;
}

async function computeConnectedDriveBreakdown(userId: string) {
  const accounts = await prisma.connectedAccount.findMany({
    where: { userId, status: "connected" },
    include: { storageAccount: true },
  });

  const totals = { photo: 0n, video: 0n, document: 0n, other: 0n };
  for (const account of accounts) {
    const storage = account.storageAccount;
    const photo = storage?.photoBytes ?? 0n;
    const video = storage?.videoBytes ?? 0n;
    const document = storage?.documentBytes ?? 0n;
    const used = storage?.usedBytes ?? 0n;
    const categorized = photo + video + document;
    totals.photo += photo;
    totals.video += video;
    totals.document += document;
    totals.other += used > categorized ? used - categorized : 0n;
  }

  return {
    photo: totals.photo.toString(),
    video: totals.video.toString(),
    document: totals.document.toString(),
    other: totals.other.toString(),
  };
}

const routingModes = ["most_available", "round_robin", "priority"] as const;
const routingPolicySchema = z.object({
  mode: z.enum(routingModes),
  priorityAccountIds: z.array(z.string().min(1)).max(100).optional(),
});

function normalizePriorityAccountIds(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

async function getOrCreateRoutingPolicy(userId: string) {
  return prisma.uploadRoutingPolicy.upsert({
    where: { userId },
    create: { userId, mode: "most_available", priorityAccountIds: [] },
    update: {},
  });
}

export async function getStorageSummaryHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  let accounts = await prisma.connectedAccount.findMany({
    where: { userId: user.id, status: "connected" },
    include: { storageAccount: true },
  });

  const missingQuota = accounts.filter(
    (account) => !account.storageAccount?.lastSyncedAt,
  );
  for (const account of missingQuota) {
    await syncGoogleQuota(account.id).catch(() => undefined);
  }
  if (missingQuota.length > 0) {
    accounts = await prisma.connectedAccount.findMany({
      where: { userId: user.id, status: "connected" },
      include: { storageAccount: true },
    });
  }

  const summary = accounts.reduce(
    (acc, account) => {
      const storage = account.storageAccount;
      acc.totalBytes += storage?.totalBytes ?? 0n;
      acc.usedBytes += storage?.usedBytes ?? 0n;
      acc.availableBytes += storage?.availableBytes ?? 0n;
      return acc;
    },
    { totalBytes: 0n, usedBytes: 0n, availableBytes: 0n },
  );

  return json({
    totalBytes: summary.totalBytes.toString(),
    usedBytes: summary.usedBytes.toString(),
    availableBytes: summary.availableBytes.toString(),
    accounts: accounts.map((account) => ({
      id: account.id,
      provider: account.provider,
      email: account.email,
      status: account.status,
      totalBytes: account.storageAccount?.totalBytes?.toString() ?? null,
      usedBytes: account.storageAccount?.usedBytes.toString() ?? "0",
      availableBytes:
        account.storageAccount?.availableBytes?.toString() ?? null,
      lastSyncedAt: account.storageAccount?.lastSyncedAt ?? null,
    })),
  });
}

export async function getRoutingPolicyHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const policy = await getOrCreateRoutingPolicy(user.id);
  return json({
    policy: {
      id: policy.id,
      mode: policy.mode,
      priorityAccountIds: normalizePriorityAccountIds(
        policy.priorityAccountIds,
      ),
      roundRobinCursor: policy.roundRobinCursor,
    },
  });
}

export async function patchRoutingPolicyHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  const gated = await requirePlanFeature(
    user.id,
    "smartDistribution",
    "Smart distribution / upload routing is included with Thunder ($9 lifetime).",
  );
  if (gated) return gated;

  const body = routingPolicySchema.parse(await request.json());
  const accountIds = [...new Set(body.priorityAccountIds ?? [])];
  const validAccounts =
    accountIds.length === 0
      ? []
      : await prisma.connectedAccount.findMany({
          where: {
            id: { in: accountIds },
            userId: user.id,
            status: "connected",
          },
          select: { id: true },
        });
  const validIds = new Set(validAccounts.map((account) => account.id));
  const priorityAccountIds = accountIds.filter((id) => validIds.has(id));
  const policy = await prisma.uploadRoutingPolicy.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      mode: body.mode,
      priorityAccountIds,
      roundRobinCursor: 0,
    },
    update: {
      mode: body.mode,
      priorityAccountIds,
      ...(body.mode !== "round_robin" ? { roundRobinCursor: 0 } : {}),
    },
  });
  return json({
    policy: {
      id: policy.id,
      mode: policy.mode,
      priorityAccountIds: normalizePriorityAccountIds(
        policy.priorityAccountIds,
      ),
      roundRobinCursor: policy.roundRobinCursor,
    },
  });
}

export async function getStorageBreakdownHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  const accounts = await prisma.connectedAccount.findMany({
    where: { userId: user.id, status: "connected" },
    include: { storageAccount: true },
  });

  const staleQuota = accounts.filter(
    (account) => !account.storageAccount?.lastSyncedAt,
  );
  for (const account of staleQuota) {
    await syncGoogleQuota(account.id).catch(() => undefined);
  }

  const refreshedAccounts =
    staleQuota.length > 0
      ? await prisma.connectedAccount.findMany({
          where: { userId: user.id, status: "connected" },
          include: { storageAccount: true },
        })
      : accounts;

  const staleBreakdown = refreshedAccounts.filter((account) =>
    isBreakdownStale(account.storageAccount?.breakdownSyncedAt),
  );
  for (const account of staleBreakdown) {
    await syncGoogleDriveBreakdown(account.id).catch(() => undefined);
  }

  return json(await computeConnectedDriveBreakdown(user.id));
}
