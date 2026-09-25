"use client";

import { useEffect, useSyncExternalStore } from "react";
import { apiFetch } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import {
  formatBandwidthLimit,
  getPlanById,
  normalizePlanId,
  planHasFeature,
  type PlanFeatureFlags,
  type PlanId,
} from "@/lib/plans";
import { readUserPlanCache, writeUserPlanCache } from "@/lib/user-plan-cache";

type BillingStatus = {
  planId: string;
  isAdmin?: boolean;
  billingEnabled?: boolean;
};

type PlanState = {
  planId: PlanId;
  isAdmin: boolean;
  billingEnabled: boolean;
  /** True only after /billing settles (or applyUserPlan). Cache alone is not enough. */
  loaded: boolean;
};

const EMPTY_STATE: PlanState = {
  planId: "free",
  isAdmin: false,
  billingEnabled: false,
  loaded: false,
};

let store: PlanState = EMPTY_STATE;
const listeners = new Set<() => void>();
let fetchPromise: Promise<void> | null = null;

function emit() {
  for (const listener of listeners) listener();
}

function setStore(next: PlanState) {
  store = next;
  emit();
}

/** Prefill plan fields from cache without marking loaded (avoids Free↔Thunder flash). */
function hydrateFromCache() {
  if (store.loaded) return;
  const cached = readUserPlanCache();
  if (!cached) return;
  store = {
    planId: cached.planId,
    isAdmin: cached.isAdmin,
    billingEnabled: cached.billingEnabled,
    loaded: false,
  };
}

if (typeof window !== "undefined") {
  hydrateFromCache();
}

function ensureBillingFetched() {
  if (fetchPromise) return fetchPromise;

  hydrateFromCache();
  emit();

  fetchPromise = apiFetch<BillingStatus>("/billing")
    .then((billing) => {
      const next: PlanState = {
        planId: normalizePlanId(billing.planId),
        isAdmin: Boolean(billing.isAdmin),
        billingEnabled: Boolean(billing.billingEnabled),
        loaded: true,
      };
      writeUserPlanCache({
        planId: next.planId,
        isAdmin: next.isAdmin,
        billingEnabled: next.billingEnabled,
      });
      setStore(next);
    })
    .catch(() => {
      setStore({ ...store, loaded: true });
    });

  return fetchPromise;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return store;
}

function getServerSnapshot() {
  return EMPTY_STATE;
}

/** Apply a known plan (e.g. after checkout) to the shared store + cache. */
export function applyUserPlan(next: {
  planId: PlanId;
  isAdmin?: boolean;
  billingEnabled?: boolean;
}) {
  const state: PlanState = {
    planId: normalizePlanId(next.planId),
    isAdmin: Boolean(next.isAdmin),
    billingEnabled: Boolean(next.billingEnabled),
    loaded: true,
  };
  writeUserPlanCache({
    planId: state.planId,
    isAdmin: state.isAdmin,
    billingEnabled: state.billingEnabled,
  });
  setStore(state);
  fetchPromise = Promise.resolve();
}

/** Reset in-memory plan store (e.g. after logout). Cache clear is separate. */
export function resetUserPlanStore() {
  store = EMPTY_STATE;
  fetchPromise = null;
  emit();
}

/** Resolves when /billing has settled for the current session. */
export function waitForUserPlan() {
  return ensureBillingFetched();
}

export function useUserPlan() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { data: session, isPending: sessionPending } = authClient.useSession();

  useEffect(() => {
    // Wait for an authenticated session so /billing is not fetched (and cached
    // as free) before cookies/session are ready — important for ProtectedRoute.
    if (sessionPending || !session) return;
    void ensureBillingFetched();
  }, [sessionPending, session]);

  const { planId, isAdmin, billingEnabled, loaded } = state;
  const plan = getPlanById(isAdmin ? "thunder" : planId);
  const effectivePlanId: PlanId = isAdmin ? "thunder" : planId;
  const hasThunder = effectivePlanId === "thunder";
  const canUpgrade = billingEnabled && !hasThunder;

  return {
    planId: effectivePlanId,
    plan,
    loaded,
    isAdmin,
    billingEnabled,
    hasThunder,
    canUpgrade,
    hasFeature: (feature: keyof PlanFeatureFlags) =>
      planHasFeature(effectivePlanId, feature),
    bandwidthLabel: formatBandwidthLimit(plan.limits.monthlyTransferBytes),
  };
}
