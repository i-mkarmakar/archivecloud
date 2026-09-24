import "server-only";

import { getPlanById } from "@/lib/plans";
import { prisma } from "@/server/config/prisma";
import { getUserPlanId } from "@/server/modules/billing/plan-gate";

export function currentYearMonth(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export async function getTransferUsage(userId: string, yearMonth?: string) {
  const ym = yearMonth ?? currentYearMonth();
  const [row, planId] = await Promise.all([
    prisma.transferUsageMonth.findUnique({
      where: { userId_yearMonth: { userId, yearMonth: ym } },
    }),
    getUserPlanId(userId),
  ]);

  const transferredBytes = row?.transferredBytes ?? 0n;
  const limitBytes = getPlanById(planId).limits.monthlyTransferBytes;
  const remainingBytes =
    limitBytes === null
      ? null
      : transferredBytes >= limitBytes
        ? 0n
        : limitBytes - transferredBytes;

  return {
    yearMonth: ym,
    planId,
    transferredBytes,
    limitBytes,
    remainingBytes,
  };
}

export async function assertTransferCapacity(
  userId: string,
  bytes: bigint,
): Promise<void> {
  const usage = await getTransferUsage(userId);
  if (usage.limitBytes === null || usage.remainingBytes === null) return;
  if (bytes > usage.remainingBytes) {
    throw new Error(
      `This transfer exceeds your ${usage.planId} plan bandwidth for ${usage.yearMonth}. Upgrade your plan or wait until next month.`,
    );
  }
}

export async function recordTransferUsage(
  userId: string,
  bytes: bigint,
  yearMonth?: string,
) {
  const ym = yearMonth ?? currentYearMonth();
  await prisma.transferUsageMonth.upsert({
    where: { userId_yearMonth: { userId, yearMonth: ym } },
    create: { userId, yearMonth: ym, transferredBytes: bytes },
    update: { transferredBytes: { increment: bytes } },
  });
}
