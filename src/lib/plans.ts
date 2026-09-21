export type PlanId = "free" | "thunder";

export type PlanFeature = {
  text: string;
  tooltip?: string;
  highlight?: boolean;
};

export type PlanFeatureFlags = {
  automation: boolean;

  folderSync: boolean;

  realtimeSync: boolean;

  smartDistribution: boolean;
};

export type PlanLimits = {
  monthlyTransferBytes: bigint | null;

  maxCloudAccounts: number | null;
  features: PlanFeatureFlags;
};

export type PlanDefinition = {
  id: PlanId;
  name: string;

  priceUsd: number;
  tagline: string;
  features: PlanFeature[];
  cta: string;
  limits: PlanLimits;
};

const GB = 1024n * 1024n * 1024n;

export const PLANS: PlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    priceUsd: 0,
    tagline: "Everything you need as a single user",
    cta: "Current Plan",
    limits: {
      monthlyTransferBytes: 50n * GB,
      maxCloudAccounts: null,
      features: {
        automation: true,
        folderSync: false,
        realtimeSync: false,
        smartDistribution: false,
      },
    },
    features: [
      { text: "Archive Cloud hub & search" },
      { text: "Unlimited cloud accounts" },
      { text: "Cross-cloud move / copy" },
      { text: "Schedule Tasks & Run History" },
      { text: "Drag & drop upload" },
      { text: "Recent files & virtual folders" },
      { text: "Bandwidth: 50 GB/month" },
    ],
  },
  {
    id: "thunder",
    name: "Thunder",
    priceUsd: 9,
    tagline: "Sync & extras, forever",
    cta: "Get Lifetime Access",
    limits: {
      monthlyTransferBytes: null,
      maxCloudAccounts: null,
      features: {
        automation: true,
        folderSync: true,
        realtimeSync: true,
        smartDistribution: true,
      },
    },
    features: [
      { text: "Everything in Free", highlight: true },
      { text: "Unlimited monthly bandwidth", highlight: true },
      { text: "Folder sync (one-way & two-way)", highlight: true },
      { text: "Automatic real-time sync", highlight: true },
      { text: "Smart distribution / routing", highlight: true },
    ],
  },
];

export function getPlanById(id: PlanId): PlanDefinition {
  return PLANS.find((plan) => plan.id === id) ?? PLANS[0];
}

export function normalizePlanId(value: string | null | undefined): PlanId {
  if (
    value === "thunder" ||
    value === "power" ||
    value === "plus" ||
    value === "pro"
  ) {
    return "thunder";
  }
  return "free";
}

function formatUsd(amount: number): string {
  return `$${amount}`;
}

export function planTagline(plan: PlanDefinition): string {
  return plan.tagline;
}

export function planPriceLabel(plan: PlanDefinition): string {
  if (plan.id === "free") return `${formatUsd(0)}`;
  return `${formatUsd(plan.priceUsd)}`;
}

export function planBillingHint(plan: PlanDefinition): string | null {
  if (plan.id === "free") return null;
  return "Lifetime · one-time";
}

export function isPlanRecommended(plan: PlanDefinition): boolean {
  return plan.id === "thunder";
}

export function planHasFeature(
  planId: PlanId,
  feature: keyof PlanFeatureFlags,
): boolean {
  return getPlanById(planId).limits.features[feature];
}

export function formatBandwidthLimit(limit: bigint | null): string {
  if (limit === null) return "Unlimited";
  const gb = Number(limit / GB);
  return `${gb} GB/month`;
}
