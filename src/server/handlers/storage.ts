import { z } from "zod";
import { prisma } from "@/server/config/prisma";
import { requireAuthUser } from "@/server/http/auth";
import { json } from "@/server/http/responses";

type BreakdownRow = { kind: string; bytes: bigint | number | string | null };

function bytesToString(value: bigint | number | string | null | undefined) {
  if (value === null || value === undefined) return "0";
  return value.toString();
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
  const accounts = await prisma.connectedAccount.findMany({
    where: { userId: user.id, status: "connected" },
    include: { storageAccount: true },
  });
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
  const rows = await prisma.$queryRaw<BreakdownRow[]>`
    SELECT
      CASE
        WHEN mime_type LIKE 'image/%' THEN 'photo'
        WHEN mime_type LIKE 'video/%' THEN 'video'
        ELSE 'document'
      END AS kind,
      COALESCE(SUM(size_bytes), 0) AS bytes
    FROM files
    WHERE user_id = ${user.id} AND status = 'active'
    GROUP BY kind
  `;
  const breakdown = { photo: "0", video: "0", document: "0" };
  for (const row of rows) {
    if (row.kind === "photo" || row.kind === "video" || row.kind === "document")
      breakdown[row.kind] = bytesToString(row.bytes);
  }
  return json(breakdown);
}
