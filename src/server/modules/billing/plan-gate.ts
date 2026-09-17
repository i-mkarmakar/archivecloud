import {
  getPlanById,
  planHasFeature,
  type PlanFeatureFlags,
  type PlanId,
} from "@/lib/plans";
import { resolveEffectivePlanId } from "@/server/modules/billing/admin";
import { prisma } from "@/server/config/prisma";
import { errorJson } from "@/server/http/responses";

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
