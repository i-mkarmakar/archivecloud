import Link from "next/link";
import { Check } from "lucide-react";
import { SectionBadge } from "@/components/home/SectionBadge";
import { cn } from "@/lib/utils";

type Plan = {
  badge: string;
  title: string;
  description: string;
  price: string;
  priceNote: string;
  features: string[];
  cta: string;
  href: string;
  highlighted?: boolean;
  outline?: boolean;
  thunderGif?: boolean;
};

const PLANS: Plan[] = [
  {
    badge: "For getting started",
    title: "Free",
    description: "Everything you need at no cost.",
    price: "$0",
    priceNote: "forever",
    features: [
      "Connect multiple cloud accounts",
      "Browse, search and manage files",
      "Virtual folders and organization",
      "File sharing and invite others",
      "Combined storage tracking",
      "Standard upload routing",
      "Access on all devices",
    ],
    cta: "Get started free",
    href: "/auth/sign-up",
  },
  {
    badge: "Most popular",
    title: "Thunder (Lifetime)",
    description: "More sync. No recurring fees.",
    price: "$9",
    priceNote: "one-time payment",
    features: [
      "All Free features",
      "Scheduled automation & sync",
      "Folder sync from provider to app",
      "Real-time provider webhooks",
      "Smart upload routing (advanced)",
      "Higher limits and faster transfers",
      "Priority support",
      "Support the development",
    ],
    cta: "Get Thunder for $9",
    href: "/auth/sign-up",
    highlighted: true,
    thunderGif: true,
  },
  {
    badge: "Full control",
    title: "Self-Host",
    description: "Run Archive Cloud on your own server.",
    price: "$0",
    priceNote: "open source",
    features: [
      "Full source code (Apache 2.0)",
      "Self-host on your infrastructure",
      "Unlimited usage, no vendor lock-in",
      "Configure via environment variables",
      "Use your own OAuth credentials",
      "Full admin controls",
      "Ideal for enterprises & privacy-focused users",
    ],
    cta: "View setup guide",
    href: "https://github.com/i-mkarmakar/archivecloud",
    outline: true,
  },
];

function PlanCta({ plan, className }: { plan: Plan; className: string }) {
  if (plan.href.startsWith("http")) {
    return (
      <a
        href={plan.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {plan.cta}
      </a>
    );
  }

  return (
    <Link href={plan.href} className={className}>
      {plan.cta}
    </Link>
  );
}

export function PricingSection() {
  return (
    <section
      id="pricing"
      className="scroll-mt-24 px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16"
    >
      <div className="mx-auto max-w-[1200px]">
        <div className="mx-auto max-w-2xl text-center">
          <SectionBadge>Pricing</SectionBadge>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#0F172A] sm:mt-4 sm:text-4xl">
            Choose what&apos;s right for you
          </h2>
          <p className="mt-2 text-sm text-[#64748B] sm:mt-3 sm:text-lg">
            Start free, upgrade to Thunder, or self-host for full control.
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:mt-12 sm:gap-5 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <article
              key={plan.title}
              className={cn(
                "relative mx-auto flex w-full max-w-[340px] flex-col rounded-2xl border bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:max-w-none sm:rounded-[24px] sm:p-7",
                plan.highlighted
                  ? "border-primary shadow-[0_18px_50px_-28px_rgba(22,131,247,0.55)] ring-1 ring-primary/25"
                  : "border-[#E5EEF7]",
              )}
            >
              <span
                className={cn(
                  "inline-flex w-fit rounded-full px-2.5 py-1 text-[10px] font-semibold sm:px-3.5 sm:py-1.5 sm:text-xs",
                  plan.highlighted
                    ? "absolute top-0 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 bg-primary text-white"
                    : "bg-[#F1F5F9] text-[#64748B]",
                )}
              >
                {plan.badge}
              </span>
              <h3
                className={cn(
                  "inline-flex items-center gap-1.5 text-lg font-bold text-[#0F172A] sm:gap-2 sm:text-xl",
                  plan.highlighted ? "mt-1.5 sm:mt-2" : "mt-3 sm:mt-4",
                )}
              >
                {plan.thunderGif ? (
                  <img
                    src="/assets/Thunder.gif"
                    alt=""
                    aria-hidden
                    className="h-5 w-5 object-contain sm:h-6 sm:w-6"
                  />
                ) : null}
                {plan.title}
              </h3>
              <p className="mt-1 text-xs text-[#64748B] sm:text-sm">
                {plan.description}
              </p>
              <div className="mt-3 flex items-end gap-1.5 sm:mt-5 sm:gap-2">
                <span className="text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl">
                  {plan.price}
                </span>
                <span className="pb-0.5 text-xs text-[#64748B] sm:pb-1 sm:text-sm">
                  {plan.priceNote}
                </span>
              </div>
              <ul className="mt-4 flex-1 space-y-2 sm:mt-6 sm:space-y-2.5">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-xs text-[#334155] sm:text-sm"
                  >
                    <span className="mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full bg-primary sm:size-4">
                      <Check
                        className="size-2 text-white sm:size-2.5"
                        strokeWidth={3}
                      />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
              <PlanCta
                plan={plan}
                className={cn(
                  "mt-5 inline-flex h-9 items-center justify-center rounded-full text-xs font-semibold shadow-[0_6px_14px_-8px_color-mix(in_oklch,var(--primary)_10%,transparent)] transition sm:mt-8 sm:h-11 sm:text-sm",
                  plan.outline
                    ? "border border-[#E5EEF7] bg-white text-[#0F172A] hover:bg-[#F5FAFF]"
                    : "bg-gradient-to-b from-primary to-[color-mix(in_srgb,var(--primary)_85%,black)] text-white hover:opacity-95",
                )}
              />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
