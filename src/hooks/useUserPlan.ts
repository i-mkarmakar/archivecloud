"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  formatBandwidthLimit,
  getPlanById,
  normalizePlanId,
  planHasFeature,
  type PlanFeatureFlags,
  type PlanId,
} from "@/lib/plans";

type BillingStatus = {
  planId: string;
  isAdmin?: boolean;
  billingEnabled?: boolean;
};

export function useUserPlan() {
  const [planId, setPlanId] = useState<PlanId>("free");
  const [loaded, setLoaded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [billingEnabled, setBillingEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void apiFetch<BillingStatus>("/billing")
      .then((billing) => {
        if (cancelled) return;
        setPlanId(normalizePlanId(billing.planId));
        setIsAdmin(Boolean(billing.isAdmin));
        setBillingEnabled(Boolean(billing.billingEnabled));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
