type PricingFeature = {
  text: string;
  tooltip?: string;
  limit?: string;
};

type Plan = {
  name: string;
  info: string;
  price: { monthly: number; yearly: number };
  features: PricingFeature[];
  btn: { text: string; href: string; variant: string };
};

export const PLANS: Plan[] = [
  {
    name: "Free",
    info: "For individuals getting started",
    price: {
      monthly: 0,
      yearly: 0,
    },
    features: [
      { text: "1 connected Google Drive" },
      { text: "Virtual folders & search" },
      { text: "Public share links" },
      { text: "Quota tracking" },
      { text: "Email sign-in" },
      { text: "Community support", tooltip: "Get help from the community" },
    ],
    btn: {
      text: "Start for free",
      href: "/signup",
      variant: "default",
    },
  },
  {
    name: "Pro",
    info: "For power users and freelancers",
    price: {
      monthly: 9,
      yearly: Math.round(9 * 12 * (1 - 0.12)),
    },
    features: [
      { text: "Up to 5 connected Drives" },
      { text: "Smart quota routing" },
      { text: "User invites & permissions" },
      { text: "Batch uploads & downloads" },
      { text: "Priority sync" },
      { text: "Priority support", tooltip: "Get faster support responses" },
    ],
    btn: {
      text: "Get started",
      href: "/signup",
      variant: "primary",
    },
  },
  {
    name: "Team",
    info: "For teams sharing across accounts",
    price: {
      monthly: 29,
      yearly: Math.round(29 * 12 * (1 - 0.12)),
    },
    features: [
      { text: "Unlimited connected Drives" },
      { text: "Team routing policies" },
      { text: "Shared folder invites" },
      { text: "Admin quota dashboard" },
      {
        text: "Dedicated support",
        tooltip: "Get priority support from our team",
      },
      { text: "Custom onboarding" },
    ],
    btn: {
      text: "Contact team",
      href: "/signup",
      variant: "default",
    },
  },
];

export const PRICING_FEATURES: PricingFeature[] = [];

export const WORKSPACE_LIMIT = 2;
