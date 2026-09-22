"use client";

import {
  ArrowUpRight,
  CircleCheckFill,
  Cloud,
  Folder,
  Person,
} from "@gravity-ui/icons";
import { Button, Skeleton } from "@heroui/react";
import { useState } from "react";
import { ConnectCloudAccountModal } from "./ConnectCloudAccountModal";

const FEATURES = [
  "Access shared files without leaving the website",
  "Search, filter, and preview items quickly",
  "Keep track of collaborative content in one inbox",
] as const;

export function SharedNoAccountEmptyState({
  onConnected,
}: {
  onConnected?: () => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="flex min-h-[min(520px,70vh)] w-full flex-col items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <div
          className="relative mb-6 flex h-28 w-44 items-center justify-center"
          aria-hidden
        >
          <Folder className="absolute left-1 top-2 h-14 w-14 text-[#c9d2df]/70" />
          <Cloud className="absolute bottom-0 right-1 h-14 w-14 text-[#c9d2df]/70" />
          <div className="relative z-10 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-gradient-to-b from-primary to-[color-mix(in_srgb,var(--primary)_85%,black)] shadow-[0_6px_14px_-8px_color-mix(in_oklch,var(--primary)_10%,transparent)]">
            <span className="relative flex items-center justify-center">
              <Person className="h-8 w-8 text-white" />
              <ArrowUpRight className="absolute -right-1 -top-0.5 h-3.5 w-3.5 text-white" />
            </span>
          </div>
        </div>

        <h2 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
          No cloud account connected
        </h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
          Connect a cloud account to see files that others have shared with you.
        </p>

        <ul className="mt-6 w-full max-w-sm space-y-3 text-left">
          {FEATURES.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm">
              <CircleCheckFill className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="text-foreground/90">{feature}</span>
            </li>
          ))}
        </ul>

        <Button
          className="mt-8 h-11 min-w-[10.5rem] cursor-pointer rounded-xl border-transparent bg-gradient-to-b from-primary to-[color-mix(in_srgb,var(--primary)_85%,black)] text-primary-foreground shadow-[0_6px_14px_-8px_color-mix(in_oklch,var(--primary)_10%,transparent)] px-6 text-sm font-semibold"
          onPress={() => setModalOpen(true)}
        >
          Connect Account
        </Button>
      </div>

      <ConnectCloudAccountModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConnected={() => {
          setModalOpen(false);
          onConnected?.();
        }}
      />
    </div>
  );
}

export function SharedNoAccountEmptyStateSkeleton() {
  return (
    <div
      className="skeleton--shimmer flex min-h-[min(520px,70vh)] w-full flex-col items-center justify-center px-4 py-12"
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="flex w-full max-w-md flex-col items-center">
        <Skeleton
          animationType="none"
          className="mb-6 h-[4.5rem] w-[4.5rem] rounded-full"
        />
        <Skeleton
          animationType="none"
          className="h-7 w-64 max-w-full rounded-lg"
        />
        <Skeleton
          animationType="none"
          className="mt-3 h-4 w-full max-w-sm rounded-lg"
        />
        <div className="mt-6 w-full max-w-sm space-y-3">
          <Skeleton animationType="none" className="h-4 w-full rounded-lg" />
          <Skeleton animationType="none" className="h-4 w-11/12 rounded-lg" />
          <Skeleton animationType="none" className="h-4 w-10/12 rounded-lg" />
        </div>
        <Skeleton animationType="none" className="mt-8 h-11 w-40 rounded-xl" />
      </div>
    </div>
  );
}
