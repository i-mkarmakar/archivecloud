import "server-only";

import { normalizePlanId, type PlanId } from "@/lib/plans";
import { env } from "@/server/config/env";
import { isPolarConfigured } from "@/server/modules/billing/polar";

export function getAdminEmails(): string[] {
  const raw = env.ADMIN_EMAIL?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function getAdminName(): string | undefined {
  const name = env.ADMIN_NAME?.trim();
  return name || undefined;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return getAdminEmails().includes(normalized);
}

export function getDefaultUserPlan(): PlanId {
  return env.DEFAULT_USER_PLAN ?? "free";
}

export function isBillingEnabled(): boolean {
  if (env.BILLING_ENABLED !== undefined) return env.BILLING_ENABLED;
  return isPolarConfigured();
}

export function resolveEffectivePlanId(
  storedPlanId: string | null | undefined,
  email: string | null | undefined,
): PlanId {
  if (isAdminEmail(email)) return "thunder";
  return normalizePlanId(storedPlanId);
}
