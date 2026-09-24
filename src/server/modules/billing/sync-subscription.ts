import "server-only";

import type { PlanId } from "@/lib/plans";
import { prisma } from "@/server/config/prisma";
import { isAdminEmail } from "@/server/modules/billing/admin";
import { planIdFromPolarProductId } from "@/server/modules/billing/polar";
import { createAuditLog } from "@/server/utils/audit";

export type PolarSubscriptionLike = {
  id: string;
  status: string;
  cancelAtPeriodEnd?: boolean | null;
  cancel_at_period_end?: boolean | null;
  currentPeriodEnd?: string | Date | null;
  current_period_end?: string | Date | null;
  customerId?: string | null;
  customer_id?: string | null;
  customer?: {
    id?: string;
    externalId?: string | null;
    external_id?: string | null;
  } | null;
  productId?: string | null;
  product_id?: string | null;
  product?: { id?: string } | null;
  metadata?: Record<string, unknown> | null;
};

export type PolarOrderLike = {
  id: string;
  status?: string | null;
  paid?: boolean | null;
  customerId?: string | null;
  customer_id?: string | null;
  customer?: {
    id?: string;
    externalId?: string | null;
    external_id?: string | null;
  } | null;
  productId?: string | null;
  product_id?: string | null;
  product?: { id?: string } | null;
  metadata?: Record<string, unknown> | null;
  items?: Array<{
    productId?: string | null;
    product_id?: string | null;
    product?: { id?: string } | null;
  }> | null;
};

function asDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function resolveUserId(entity: {
  metadata?: Record<string, unknown> | null;
  customer?: {
    externalId?: string | null;
    external_id?: string | null;
  } | null;
}): string | null {
  const fromMeta = entity.metadata?.userId ?? entity.metadata?.user_id;
  if (typeof fromMeta === "string" && fromMeta.trim().length > 0) {
    return fromMeta.trim();
  }
  const external =
    entity.customer?.externalId ?? entity.customer?.external_id ?? null;
  if (typeof external === "string" && external.trim().length > 0) {
    return external.trim();
  }
  return null;
}

function resolvePlanIdFromMetaAndProduct(
  metadata: Record<string, unknown> | null | undefined,
  productId: string | null | undefined,
): PlanId {
  const fromMeta = metadata?.planId ?? metadata?.plan_id;
  if (typeof fromMeta === "string") {
    if (
      fromMeta === "thunder" ||
      fromMeta === "power" ||
      fromMeta === "plus" ||
      fromMeta === "pro"
    ) {
      return "thunder";
    }
    if (fromMeta === "free") return "free";
  }
  if (productId) {
    const mapped = planIdFromPolarProductId(productId);
    if (mapped) return mapped;
  }
  return "thunder";
}

function orderProductId(order: PolarOrderLike): string {
  if (order.productId) return order.productId;
  if (order.product_id) return order.product_id;
  if (order.product?.id) return order.product.id;
  const fromItem =
    order.items?.[0]?.productId ??
    order.items?.[0]?.product_id ??
    order.items?.[0]?.product?.id;
  if (fromItem) return fromItem;
  return "unknown";
}

function isEntitledStatus(status: string): boolean {
  return (
    status === "active" ||
    status === "trialing" ||
    status === "past_due" ||
    status === "lifetime"
  );
}

export async function upsertPolarSubscription(sub: PolarSubscriptionLike) {
  const userId = resolveUserId(sub);
  if (!userId) {
    console.error("Polar subscription missing user mapping", sub.id);
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    console.error("Polar subscription user not found", userId);
    return;
  }

  const productId =
    sub.productId ?? sub.product_id ?? sub.product?.id ?? "unknown";
  const planId = resolvePlanIdFromMetaAndProduct(sub.metadata, productId);
  const polarCustomerId =
    sub.customerId ?? sub.customer_id ?? sub.customer?.id ?? null;

  await prisma.billingSubscription.upsert({
    where: { polarSubscriptionId: sub.id },
    create: {
      userId,
      polarSubscriptionId: sub.id,
      polarProductId: productId,
      planId,
      status: sub.status,
      currentPeriodEnd: asDate(sub.currentPeriodEnd ?? sub.current_period_end),
      cancelAtPeriodEnd: Boolean(
        sub.cancelAtPeriodEnd ?? sub.cancel_at_period_end,
      ),
    },
    update: {
      polarProductId: productId,
      planId,
      status: sub.status,
      currentPeriodEnd: asDate(sub.currentPeriodEnd ?? sub.current_period_end),
      cancelAtPeriodEnd: Boolean(
        sub.cancelAtPeriodEnd ?? sub.cancel_at_period_end,
      ),
    },
  });

  const nextPlan: PlanId = isEntitledStatus(sub.status) ? planId : "free";
  const resolvedPlan: PlanId = isAdminEmail(user.email) ? "thunder" : nextPlan;

  await prisma.user.update({
    where: { id: userId },
    data: {
      planId: resolvedPlan,
      ...(polarCustomerId ? { polarCustomerId } : {}),
    },
  });

  await createAuditLog(
    userId,
    "BILLING_SUBSCRIPTION_UPSERTED",
    "billing",
    sub.id,
    {
      status: sub.status,
      planId: resolvedPlan,
    },
  );
}

export async function grantLifetimeFromPolarOrder(order: PolarOrderLike) {
  const userId = resolveUserId(order);
  if (!userId) {
    console.error("Polar order missing user mapping", order.id);
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    console.error("Polar order user not found", userId);
    return;
  }

  const productId = orderProductId(order);
  const planId = resolvePlanIdFromMetaAndProduct(order.metadata, productId);
  const polarCustomerId =
    order.customerId ?? order.customer_id ?? order.customer?.id ?? null;
  const polarOrderKey = `order:${order.id}`;

  await prisma.billingSubscription.upsert({
    where: { polarSubscriptionId: polarOrderKey },
    create: {
      userId,
      polarSubscriptionId: polarOrderKey,
      polarProductId: productId,
      planId,
      status: "lifetime",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    },
    update: {
      polarProductId: productId,
      planId,
      status: "lifetime",
      cancelAtPeriodEnd: false,
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: {
      planId,
      ...(polarCustomerId ? { polarCustomerId } : {}),
    },
  });

  await createAuditLog(
    userId,
    "BILLING_LIFETIME_GRANTED",
    "billing",
    order.id,
    {
      planId,
      productId,
    },
  );
}

export async function revokeLifetimeFromPolarOrder(order: PolarOrderLike) {
  const polarOrderKey = `order:${order.id}`;
  const existing = await prisma.billingSubscription.findUnique({
    where: { polarSubscriptionId: polarOrderKey },
  });
  if (!existing) return;

  await prisma.billingSubscription.update({
    where: { id: existing.id },
    data: { status: "refunded" },
  });

  const stillActive = await prisma.billingSubscription.findFirst({
    where: {
      userId: existing.userId,
      status: { in: ["active", "trialing", "past_due", "lifetime"] },
      NOT: { id: existing.id },
    },
  });

  if (!stillActive) {
    const user = await prisma.user.findUnique({
      where: { id: existing.userId },
      select: { email: true },
    });
    if (!isAdminEmail(user?.email)) {
      await prisma.user.update({
        where: { id: existing.userId },
        data: { planId: "free" },
      });
    }
  }

  await createAuditLog(
    existing.userId,
    "BILLING_LIFETIME_REVOKED",
    "billing",
    order.id,
    { status: "refunded" },
  );
}

export async function markPolarSubscriptionEnded(
  polarSubscriptionId: string,
  status: string,
) {
  const existing = await prisma.billingSubscription.findUnique({
    where: { polarSubscriptionId },
  });
  if (!existing) return;

  await prisma.billingSubscription.update({
    where: { id: existing.id },
    data: { status },
  });

  const stillActive = await prisma.billingSubscription.findFirst({
    where: {
      userId: existing.userId,
      status: { in: ["active", "trialing", "past_due", "lifetime"] },
      NOT: { id: existing.id },
    },
  });

  if (!stillActive) {
    const user = await prisma.user.findUnique({
      where: { id: existing.userId },
      select: { email: true },
    });
    if (!isAdminEmail(user?.email)) {
      await prisma.user.update({
        where: { id: existing.userId },
        data: { planId: "free" },
      });
    }
  }

  await createAuditLog(
    existing.userId,
    "BILLING_SUBSCRIPTION_ENDED",
    "billing",
    polarSubscriptionId,
    { status },
  );
}
