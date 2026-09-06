export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { Webhooks } from "@polar-sh/nextjs";
import { env } from "@/server/config/env";
import {
  grantLifetimeFromPolarOrder,
  markPolarSubscriptionEnded,
  revokeLifetimeFromPolarOrder,
  upsertPolarSubscription,
} from "@/server/modules/billing/sync-subscription";
import { errorJson } from "@/server/http/responses";

export const POST = async (request: Request) => {
  if (!env.POLAR_WEBHOOK_SECRET?.trim()) {
    return errorJson(
      "BILLING_NOT_CONFIGURED",
      "POLAR_WEBHOOK_SECRET is not set.",
      503,
    );
  }

  return Webhooks({
    webhookSecret: env.POLAR_WEBHOOK_SECRET,
    onOrderPaid: async (payload) => {
      await grantLifetimeFromPolarOrder(payload.data as never);
    },
    onOrderRefunded: async (payload) => {
      await revokeLifetimeFromPolarOrder(payload.data as never);
    },
    onSubscriptionCreated: async (payload) => {
      await upsertPolarSubscription(payload.data as never);
    },
    onSubscriptionUpdated: async (payload) => {
      await upsertPolarSubscription(payload.data as never);
    },
    onSubscriptionActive: async (payload) => {
      await upsertPolarSubscription(payload.data as never);
    },
    onSubscriptionCanceled: async (payload) => {
      await upsertPolarSubscription(payload.data as never);
    },
    onSubscriptionRevoked: async (payload) => {
      await markPolarSubscriptionEnded(payload.data.id, "revoked");
    },
  })(request as never);
};
