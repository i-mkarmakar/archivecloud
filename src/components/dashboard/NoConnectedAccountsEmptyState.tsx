"use client";

import { Layers, Magnifier, ShieldCheck } from "@gravity-ui/icons";
import { Button, Skeleton } from "@heroui/react";
import { useState } from "react";
import { ProviderBrandIcon } from "@/components/ProviderBrandIcon";
import { getFirstName, getTimeGreeting } from "@/lib/greeting";
import type { SupportedProviderId } from "@/lib/providers";
import { cn } from "@/lib/utils";
import { ConnectCloudAccountModal } from "./ConnectCloudAccountModal";

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
    iconClass: "text-sky-600",
  },
  {
    title: "Secure by Design",
    description:
      "Tokens stay encrypted and uploads stream to your drives. We never store your files.",
    icon: ShieldCheck,
    iconClass: "text-emerald-600",
  },
] as const;

export function NoConnectedAccountsEmptyState({
  userName,
  onConnected,
}: {
  userName?: string | null;
  onConnected?: () => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalProviderId, setModalProviderId] =
    useState<SupportedProviderId | null>(null);

  function quickConnect(provider: QuickConnectProvider) {
    setModalProviderId(provider.id);
    setModalOpen(true);
  }

  const firstName = getFirstName(userName);

  return (
    <div className="mx-auto w-full max-w-5xl px-1 pb-10 pt-2 sm:pt-4">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#1e3a5f] sm:text-3xl lg:text-[2rem]">
          {getTimeGreeting()},{" "}
          <span className="text-[#1877f2]">{firstName}</span>
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#6b7280] sm:text-[15px]">
          Your cloud accounts are more powerful with us. Connect your cloud
          accounts and reclaim your productive flow.
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <div
              key={feature.title}
              className="rounded-xl border border-[#e8ecf2] bg-white px-4 py-4 shadow-sm"
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

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {QUICK_CONNECT_PROVIDERS.map((provider) => (
          <div
            key={provider.id}
            className="flex flex-col items-center gap-3 rounded-xl border border-[#e8ecf2] bg-white px-4 py-5 shadow-sm"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center">
              <ProviderBrandIcon
                name={provider.id}
                className="h-8 w-8"
                fallback={
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e8f1fc] text-xs font-bold text-[#1877f2]">
                    {provider.label.charAt(0)}
                  </span>
                }
              />
            </span>
            <p className="text-center text-sm font-semibold text-[#2d3748]">
              {provider.label}
            </p>
            <Button
              size="sm"
              className="h-7 w-auto cursor-pointer bg-[#1877f2] px-3 text-[11px] text-white"
              onPress={() => quickConnect(provider)}
            >
              Quick connect
            </Button>
          </div>
        ))}
      </div>

      <ConnectCloudAccountModal
        open={modalOpen}
        initialProviderId={modalProviderId}
        onClose={() => {
          setModalOpen(false);
          setModalProviderId(null);
        }}
        onConnected={() => {
          setModalOpen(false);
          setModalProviderId(null);
          onConnected?.();
        }}
      />
    </div>
  );
}

export function NoConnectedAccountsEmptyStateSkeleton() {
  return (
    <div
      className="skeleton--shimmer relative mx-auto w-full max-w-5xl overflow-hidden px-1 pb-10 pt-2 sm:pt-4"
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="max-w-2xl space-y-3">
        <Skeleton
          animationType="none"
          className="h-9 w-72 max-w-full rounded-lg sm:h-10 sm:w-80"
        />
        <Skeleton
          animationType="none"
          className="h-4 w-full max-w-xl rounded-lg"
        />
        <Skeleton
          animationType="none"
          className="h-4 w-4/5 max-w-lg rounded-lg"
        />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {["feature-a", "feature-b", "feature-c"].map((id) => (
          <div
            key={id}
            className="rounded-xl border border-[#e8ecf2] bg-white px-4 py-4 shadow-sm"
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

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
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
            className="flex flex-col items-center gap-3 rounded-xl border border-[#e8ecf2] bg-white px-4 py-5 shadow-sm"
          >
            <Skeleton animationType="none" className="h-8 w-8 rounded-lg" />
            <Skeleton animationType="none" className="h-4 w-24 rounded-lg" />
            <Skeleton animationType="none" className="h-7 w-28 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
