import { z } from "zod";
import { normalizePlanId, type PlanId } from "@/lib/plans";
import { prisma } from "@/server/config/prisma";
import { env } from "@/server/config/env";
import { requireAuthUser } from "@/server/http/auth";
import { errorJson, json } from "@/server/http/responses";
import { isAdminEmail, isBillingEnabled } from "@/server/modules/billing/admin";
import { getUserPlanId } from "@/server/modules/billing/plan-gate";
import {
  createPolarClient,
  getPolarProductId,
  isPolarConfigured,
} from "@/server/modules/billing/polar";
import { createAuditLog } from "@/server/utils/audit";

export async function getBillingStatusHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  const dbUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: {
      planId: true,
      polarCustomerId: true,
      email: true,
    },
  });

  const subscription = await prisma.billingSubscription.findFirst({
    where: {
      userId: user.id,
      status: { in: ["active", "trialing", "past_due", "lifetime"] },
    },
    orderBy: { updatedAt: "desc" },
  });

  const planId: PlanId = await getUserPlanId(user.id);

  return json({
    planId,
    isAdmin: isAdminEmail(dbUser.email),
    billingEnabled: isBillingEnabled(),
    polarConfigured: isPolarConfigured(),
    polarCustomerId: dbUser.polarCustomerId,
    subscription: subscription
      ? {
          id: subscription.id,
          status: subscription.status,
          planId: normalizePlanId(subscription.planId),
          currentPeriodEnd:
            subscription.currentPeriodEnd?.toISOString() ?? null,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        }
      : null,
  });
}

export async function createBillingCheckoutHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  if (!isBillingEnabled()) {
    return errorJson(
      "BILLING_DISABLED",
      "Paid checkout is disabled on this Archive Cloud instance.",
      503,
    );
  }

  if (!isPolarConfigured()) {
    return errorJson(
      "BILLING_NOT_CONFIGURED",
      "Polar billing is not configured yet. Add POLAR_ACCESS_TOKEN and POLAR_PRODUCT_THUNDER_LIFETIME to .env.",
      503,
    );
  }

  const body = z
    .object({
      planId: z.enum(["thunder", "power"]),
    })
    .parse(await request.json());

  const planId = body.planId === "power" ? "thunder" : body.planId;
  const productId = getPolarProductId(planId);
  if (!productId) {
    return errorJson(
      "PRODUCT_NOT_CONFIGURED",
      "Missing Polar product ID for Thunder lifetime. Set POLAR_PRODUCT_THUNDER_LIFETIME (or legacy POLAR_PRODUCT_POWER_LIFETIME) in .env.",
      503,
    );
  }

  const dbUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { email: true, name: true, planId: true },
  });

  if (
    normalizePlanId(dbUser.planId) === "thunder" ||
    isAdminEmail(dbUser.email)
  ) {
    return errorJson(
      "ALREADY_THUNDER",
      "You already have Thunder lifetime access.",
      409,
    );
  }

  const polar = createPolarClient();
  const successUrl = `${env.APP_URL}/billing/success?checkout_id={CHECKOUT_ID}`;
  const returnUrl = `${env.APP_URL}/home`;

  const checkout = await polar.checkouts.create({
    products: [productId],
    successUrl,
    returnUrl,
    customerEmail: dbUser.email,
    customerName: dbUser.name,
    externalCustomerId: user.id,
    metadata: {
      userId: user.id,
      planId,
      period: "lifetime",
    },
  });

  await createAuditLog(
    user.id,
    "BILLING_CHECKOUT_CREATED",
    "billing",
    undefined,
    {
      planId,
      period: "lifetime",
      checkoutId: checkout.id,
    },
  );

  return json({ url: checkout.url, checkoutId: checkout.id });
}

function orderBelongsToUser(
  order: {
    customerId: string;
    customer: { externalId?: string | null; email?: string | null };
    metadata: Record<string, unknown>;
  },
  user: { id: string; email: string; polarCustomerId: string | null },
) {
  const userId = user.id.trim();
  const metaUserId = order.metadata?.userId;
  if (typeof metaUserId === "string" && metaUserId.trim() === userId)
    return true;
  if (order.customer.externalId?.trim() === userId) return true;
  if (user.polarCustomerId && order.customerId === user.polarCustomerId)
    return true;
  if (
    order.customer.email &&
    order.customer.email.toLowerCase() === user.email.toLowerCase()
  ) {
    return true;
  }
  return false;
}

async function resolveDownloadUrl(
  polar: ReturnType<typeof createPolarClient>,
  orderId: string,
  alreadyGenerated: boolean,
): Promise<string | null> {
  // Invoice PDF needs billing name/address; generation can fail or lag.
  // Prefer invoice when ready, otherwise fall back to receipt PDF.
  try {
    if (!alreadyGenerated) {
      try {
        await polar.orders.generateInvoice({ id: orderId });
      } catch {
        // Missing billing details or already generating.
      }
    }
    try {
      const invoice = await polar.orders.invoice({ id: orderId });
      if (invoice.url) return invoice.url;
    } catch {
      // Not ready yet.
    }
  } catch {
    // Ignore and try receipt.
  }

  try {
    const receipt = await polar.orders.receipt({ id: orderId });
    if (receipt?.url) return receipt.url;
  } catch {
    // Receipt may still be rendering (202).
  }

  return null;
}

export async function getBillingInvoiceHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  if (!isPolarConfigured()) {
    return errorJson(
      "BILLING_NOT_CONFIGURED",
      "Polar billing is not configured yet.",
      503,
    );
  }

  const url = new URL(request.url);
  const checkoutId = url.searchParams.get("checkout_id")?.trim();
  const orderId = url.searchParams.get("order_id")?.trim();
  if (!checkoutId && !orderId) {
    return errorJson(
      "VALIDATION_ERROR",
      "checkout_id or order_id is required.",
      400,
    );
  }

  const dbUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { email: true, polarCustomerId: true },
  });

  const polar = createPolarClient();
  let order: Awaited<ReturnType<typeof polar.orders.get>> | null = null;

  if (orderId) {
    try {
      order = await polar.orders.get({ id: orderId });
    } catch {
      order = null;
    }
  } else if (checkoutId) {
    const page = await polar.orders.list({
      checkoutId,
      limit: 1,
    });
    order = page.result.items[0] ?? null;

    if (!order) {
      const byCustomer = await polar.orders.list({
        externalCustomerId: user.id.trim(),
        limit: 1,
        sorting: ["-created_at"],
      });
      order = byCustomer.result.items[0] ?? null;
    }
  }

  if (
    !order ||
    !orderBelongsToUser(order, {
      id: user.id,
      email: dbUser.email,
      polarCustomerId: dbUser.polarCustomerId,
    })
  ) {
    return json({
      invoiceNumber: null,
      downloadUrl: null,
      pending: true,
    });
  }

  const invoiceNumber = order.invoiceNumber;
  if (!invoiceNumber) {
    return json({
      invoiceNumber: null,
      downloadUrl: null,
      pending: true,
    });
  }

  const downloadUrl = await resolveDownloadUrl(
    polar,
    order.id,
    order.isInvoiceGenerated,
  );

  return json({
    invoiceNumber,
    downloadUrl,
    pending: !downloadUrl,
  });
}

export async function listBillingHistoryHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  if (!isPolarConfigured()) {
    return errorJson(
      "BILLING_NOT_CONFIGURED",
      "Polar billing is not configured yet.",
      503,
    );
  }

  const dbUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { email: true, polarCustomerId: true },
  });

  const polar = createPolarClient();
  const externalId = user.id.trim();

  const pages = await Promise.all([
    polar.orders.list({
      externalCustomerId: externalId,
      limit: 50,
      sorting: ["-created_at"],
    }),
    user.id !== externalId
      ? polar.orders.list({
          externalCustomerId: user.id,
          limit: 50,
          sorting: ["-created_at"],
        })
      : Promise.resolve(null),
    dbUser.polarCustomerId
      ? polar.orders.list({
          customerId: dbUser.polarCustomerId,
          limit: 50,
          sorting: ["-created_at"],
        })
      : Promise.resolve(null),
  ]);

  const byId = new Map<string, (typeof pages)[0]["result"]["items"][number]>();
  for (const page of pages) {
    if (!page) continue;
    for (const item of page.result.items) {
      byId.set(item.id, item);
    }
  }

  const items = [...byId.values()]
    .filter((order) =>
      orderBelongsToUser(order, {
        id: user.id,
        email: dbUser.email,
        polarCustomerId: dbUser.polarCustomerId,
      }),
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .map((order) => ({
      id: order.id,
      invoiceNumber: order.invoiceNumber,
      status: order.status,
      paid: order.paid,
      totalAmount: order.totalAmount,
      currency: order.currency,
      createdAt: order.createdAt.toISOString(),
      checkoutId: order.checkoutId,
    }));

  return json({ items });
}
