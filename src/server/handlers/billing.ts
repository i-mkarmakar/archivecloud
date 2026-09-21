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
