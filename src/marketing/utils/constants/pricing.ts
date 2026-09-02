type PricingFeature = {
  text: string;
  tooltip?: string;
  limit?: string;
};

type Plan = {
  name: string;
  info: string;
  price: number;
  features: PricingFeature[];
  btn: { text: string; href: string; variant: string };
};

export const PLANS: Plan[] = [
  {
    name: "Free",
    info: "For individuals getting started",
    price: 0,
    features: [
      { text: "Unlimited connected Google Drives" },
      { text: "Smart upload routing" },
      { text: "Virtual folders & search" },
      { text: "Public share links" },
      { text: "Quota tracking" },
      { text: "Email or Google sign-in" },
    ],
    btn: {
      text: "Start for free",
      href: "/signup",
      variant: "default",
    },
  },
];

export const PRICING_FEATURES: PricingFeature[] = [];

export const WORKSPACE_LIMIT = 2;
