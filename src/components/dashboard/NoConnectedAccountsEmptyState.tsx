"use client";

import { Layers, Magnifier, ShieldCheck } from "@gravity-ui/icons";
import { Skeleton } from "@heroui/react";
import { ProviderBrandIcon } from "@/components/ProviderBrandIcon";
import type { SupportedProviderId } from "@/lib/providers";
import { cn } from "@/lib/utils";

type QuickConnectProvider = {
  id: SupportedProviderId;
  label: string;
};

const QUICK_CONNECT_PROVIDERS: QuickConnectProvider[] = [
  { id: "google_drive", label: "Google Drive" },
  { id: "google_shared_drive", label: "Shared Drive" },
  { id: "dropbox", label: "Dropbox" },
  { id: "onedrive", label: "OneDrive" },
  { id: "pcloud", label: "pCloud" },
  { id: "google_photos", label: "Google Photos" },
  { id: "icloud_photos", label: "iCloud Photos" },
  { id: "icloud_drive", label: "iCloud Drive" },
];

const FEATURES = [
  {
    title: "Unified Search",
    description:
      "Find any file across all your clouds in one single search bar.",
    icon: Magnifier,
    iconClass: "text-emerald-600",
  },
  {
    title: "Total Control",
    description:
      "Stop juggling different apps. Manage all your cloud drives from a single place.",
    icon: Layers,
    iconClass: "text-primary",
  },
  {
    title: "Secure by Design",
    description:
      "Tokens stay encrypted and uploads stream to your drives. We never store your files.",
    icon: ShieldCheck,
    iconClass: "text-emerald-600",
  },
] as const;

export const CONNECT_ONBOARDING_DESCRIPTION =
  "Your cloud accounts are more powerful with us. Connect your cloud accounts and reclaim your productive flow.";

export function NoConnectedAccountsEmptyState({
  onQuickConnect,
}: {
  onQuickConnect?: (providerId: SupportedProviderId) => void;
}) {
  return (
    <div className="w-full min-w-0 pb-10 pt-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {FEATURES.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <div
              key={feature.title}
              className={cn(
                "rounded-xl border border-[#e8ecf2] bg-white px-4 py-4 shadow-sm",
                index === 2 && "col-span-2 sm:col-span-1",
              )}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f4f7fa]">
                <Icon className={cn("h-5 w-5", feature.iconClass)} />
              </div>
              <h2 className="mt-3 text-sm font-bold text-[#1e3a5f]">
                {feature.title}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[#6b7280]">
                {feature.description}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
        {QUICK_CONNECT_PROVIDERS.map((provider) => (
          <button
            key={provider.id}
            type="button"
            onClick={() => onQuickConnect?.(provider.id)}
            className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-[#E5EEF7] bg-white px-2 py-3 text-center shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:-translate-y-0.5 hover:border-[#BFDFFF] hover:shadow-[0_12px_28px_-18px_rgba(22,131,247,0.45)] sm:gap-3 sm:px-4 sm:py-5"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center sm:h-8 sm:w-8">
              <ProviderBrandIcon
                name={provider.id}
                className="h-7 w-7 sm:h-8 sm:w-8"
                fallback={
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary sm:h-8 sm:w-8">
                    {provider.label.charAt(0)}
                  </span>
                }
              />
            </span>
            <p className="text-center text-[11px] font-medium leading-tight text-[#0F172A] sm:text-sm sm:font-semibold sm:text-[#2d3748]">
              {provider.label}
            </p>
            <span className="pointer-events-none hidden h-7 w-auto items-center justify-center rounded-full bg-gradient-to-b from-primary to-[color-mix(in_srgb,var(--primary)_85%,black)] px-3 text-[11px] font-medium text-primary-foreground shadow-[0_6px_14px_-8px_color-mix(in_oklch,var(--primary)_10%,transparent)] sm:inline-flex">
              Quick connect
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function NoConnectedAccountsEmptyStateSkeleton() {
  return (
    <div
      className="skeleton--shimmer relative w-full min-w-0 overflow-hidden pb-10 pt-4"
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {["feature-a", "feature-b", "feature-c"].map((id, index) => (
          <div
            key={id}
            className={cn(
              "rounded-xl border border-[#e8ecf2] bg-white px-4 py-4 shadow-sm",
              index === 2 && "col-span-2 sm:col-span-1",
            )}
          >
            <div className="flex h-9 w-9 items-center justify-center">
              <Skeleton animationType="none" className="h-9 w-9 rounded-lg" />
            </div>
            <Skeleton
              animationType="none"
              className="mt-3 h-4 w-28 rounded-lg"
            />
            <div className="mt-2 space-y-2">
              <Skeleton animationType="none" className="h-3 w-full rounded" />
              <Skeleton animationType="none" className="h-3 w-4/5 rounded" />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
        {[
          "provider-a",
          "provider-b",
          "provider-c",
          "provider-d",
          "provider-e",
          "provider-f",
          "provider-g",
          "provider-h",
        ].map((id) => (
          <div
            key={id}
            className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-[#E5EEF7] bg-white px-2 py-3 shadow-sm sm:gap-3 sm:px-4 sm:py-5"
          >
            <Skeleton
              animationType="none"
              className="h-7 w-7 rounded-lg sm:h-8 sm:w-8"
            />
            <Skeleton
              animationType="none"
              className="h-3 w-16 rounded-lg sm:h-4 sm:w-24"
            />
            <Skeleton
              animationType="none"
              className="hidden h-7 w-28 rounded-lg sm:block"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
