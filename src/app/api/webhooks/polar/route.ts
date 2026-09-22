export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { env } from "@/server/config/env";
import {
  polarWebhookHeaders,
  verifyAndParsePolarWebhook,
  WebhookVerificationError,
} from "@/server/modules/billing/polar-webhooks";
import {
  grantLifetimeFromPolarOrder,
  markPolarSubscriptionEnded,
  revokeLifetimeFromPolarOrder,
  upsertPolarSubscription,
} from "@/server/modules/billing/sync-subscription";
import { errorJson } from "@/server/http/responses";

async function dispatchPolarEvent(payload: {
  type: string;
  data: unknown;
}): Promise<void> {
  switch (payload.type) {
    case "order.paid":
      await grantLifetimeFromPolarOrder(payload.data as never);
      break;
    case "order.refunded":
      await revokeLifetimeFromPolarOrder(payload.data as never);
      break;
    case "subscription.created":
    case "subscription.updated":
    case "subscription.active":
    case "subscription.canceled":
    case "subscription.uncanceled":
      await upsertPolarSubscription(payload.data as never);
      break;
    case "subscription.revoked":
      await markPolarSubscriptionEnded(
        (payload.data as { id: string }).id,
        "revoked",
      );
      break;
    default:
      break;
  }
}

/**
 * Polar webhook endpoint — see:
 * https://polar.sh/docs/integrate/sdk/adapters/nextjs
 * https://polar.sh/docs/integrate/webhooks/delivery
 */
export const POST = async (request: Request) => {
  const webhookSecret = env.POLAR_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return errorJson(
      "BILLING_NOT_CONFIGURED",
      "POLAR_WEBHOOK_SECRET is not set.",
      503,
    );
  }

  const requestBody = await request.text();
  const webhookHeaders = polarWebhookHeaders(request.headers);

  let webhookPayload: { type: string; data: unknown };
  try {
    webhookPayload = verifyAndParsePolarWebhook(
      requestBody,
      webhookHeaders,
      webhookSecret,
    ) as { type: string; data: unknown };
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      // Polar docs: 403 on verification failure
      return NextResponse.json({ received: false }, { status: 403 });
    }
    throw error;
  }

  await dispatchPolarEvent(webhookPayload);

  // Prefer 2xx quickly; 202 matches Polar custom-handler examples
  return NextResponse.json({ received: true }, { status: 202 });
};
