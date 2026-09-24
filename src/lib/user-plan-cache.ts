import { normalizePlanId, type PlanId } from "@/lib/plans";

const STORAGE_KEY = "archivecloud:user-plan";

export type CachedUserPlan = {
  planId: PlanId;
  isAdmin: boolean;
  billingEnabled: boolean;
};

let memoryCache: CachedUserPlan | null = null;

export function readUserPlanCache(): CachedUserPlan | null {
  if (memoryCache) return memoryCache;
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      planId?: string;
      isAdmin?: boolean;
      billingEnabled?: boolean;
    };
    if (!parsed.planId) return null;
    memoryCache = {
      planId: normalizePlanId(parsed.planId),
      isAdmin: Boolean(parsed.isAdmin),
      billingEnabled: Boolean(parsed.billingEnabled),
    };
    return memoryCache;
  } catch {
    return null;
  }
}

export function writeUserPlanCache(next: CachedUserPlan) {
  memoryCache = next;
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
}

export function clearUserPlanCache() {
  memoryCache = null;
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
