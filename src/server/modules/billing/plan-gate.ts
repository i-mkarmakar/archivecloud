import "server-only";

import {
  getPlanById,
  type PlanFeatureFlags,
  type PlanId,
  planHasFeature,
} from "@/lib/plans";
import { prisma } from "@/server/config/prisma";
import { errorJson } from "@/server/http/responses";
import { resolveEffectivePlanId } from "@/server/modules/billing/admin";

export async function getUserPlanId(userId: string): Promise<PlanId> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { planId: true, email: true },
  });
  return resolveEffectivePlanId(user?.planId, user?.email);
}

export async function requirePlanFeature(
  userId: string,
  feature: keyof PlanFeatureFlags,
  message?: string,
): Promise<Response | null> {
  const planId = await getUserPlanId(userId);
  if (planHasFeature(planId, feature)) return null;
  const plan = getPlanById(planId);
  return errorJson(
    "PLAN_UPGRADE_REQUIRED",
    message ??
      `This feature is included with Thunder ($9 lifetime). Your current plan is ${plan.name}.`,
    402,
  );
}
