import { Polar } from "@polar-sh/sdk";
import type { PlanId } from "@/lib/plans";
import { env } from "@/server/config/env";

export type PaidPlanId = Exclude<PlanId, "free">;

export function isPolarConfigured(): boolean {
  return Boolean(env.POLAR_ACCESS_TOKEN?.trim());
}

export function getPolarServer(): "sandbox" | "production" {
  return env.POLAR_SERVER === "production" ? "production" : "sandbox";
}

export function createPolarClient(): Polar {
  if (!env.POLAR_ACCESS_TOKEN?.trim()) {
    throw new Error("POLAR_ACCESS_TOKEN is not configured.");
  }
  return new Polar({
    accessToken: env.POLAR_ACCESS_TOKEN,
    server: getPolarServer(),
  });
}

function thunderProductId(): string | null {
  return (
    env.POLAR_PRODUCT_THUNDER_LIFETIME?.trim() ||
    env.POLAR_PRODUCT_POWER_LIFETIME?.trim() ||
    null
  );
}

export function getPolarProductId(planId: PaidPlanId): string | null {
  if (planId !== "thunder") return null;
  return thunderProductId();
}

export function planIdFromPolarProductId(productId: string): PlanId | null {
  const lifetime = thunderProductId();
  if (lifetime && productId === lifetime) return "thunder";
  return null;
}
