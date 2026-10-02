"use client";

import { CircleCheckFill } from "@gravity-ui/icons";
import { Button, Skeleton } from "@heroui/react";
import { useState } from "react";
import { EMPTY_STATE_PNG_CLASS } from "@/lib/utils";
import { ConnectCloudAccountModal } from "./ConnectCloudAccountModal";

const SHARED_FEATURES = [
  "Access shared files without leaving the website",
  "Search, filter, and preview items quickly",
  "Keep track of collaborative content in one inbox",
] as const;

const RECENT_FEATURES = [
  "Access recent files without leaving the website",
  "Search, filter, and preview items quickly",
  "Keep track of your content in one inbox",
] as const;

const NOTHING_FEATURES = [
  "Track shared files across connected clouds in one place",
  "Resume working on shared documents instantly",
  "Filter and search shared items by type",
] as const;

function EmptyArt({ src }: { src: string }) {
  return <img src={src} alt="" className={EMPTY_STATE_PNG_CLASS} aria-hidden />;
}

function NoAccountEmptyState({
  imageSrc,
  description,
  features,
  onConnected,
}: {
  imageSrc: string;
  description: string;
  features: readonly string[];
  onConnected?: () => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="flex min-h-[min(520px,70vh)] w-full flex-col items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <EmptyArt src={imageSrc} />

        <h2 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
          No cloud account connected
        </h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
          {description}
        </p>

        <ul className="mt-6 w-full max-w-sm space-y-3 text-left">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm">
              <CircleCheckFill className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="text-foreground/90">{feature}</span>
            </li>
          ))}
        </ul>

        <Button
          className="mt-8 h-11 min-w-[10.5rem] cursor-pointer rounded-xl border-transparent bg-gradient-to-b from-primary to-[color-mix(in_srgb,var(--primary)_85%,black)] px-6 text-sm font-semibold text-primary-foreground shadow-[0_6px_14px_-8px_color-mix(in_oklch,var(--primary)_10%,transparent)]"
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

export function SharedNoAccountEmptyState({
  onConnected,
}: {
  onConnected?: () => void;
}) {
  return (
    <NoAccountEmptyState
      imageSrc="/blank/shared-with-me.png"
      description="Connect a cloud account to see files that others have shared with you."
      features={SHARED_FEATURES}
      onConnected={onConnected}
    />
  );
}

export function RecentNoAccountEmptyState({
  onConnected,
}: {
  onConnected?: () => void;
}) {
  return (
    <NoAccountEmptyState
      imageSrc="/blank/recents.png"
      description="Connect a cloud account to see your recent files across all platforms."
      features={RECENT_FEATURES}
      onConnected={onConnected}
    />
  );
}

/** Shown when accounts are connected but nothing is shared with the user yet. */
export function SharedNothingEmptyState() {
  return (
    <div className="flex min-h-[min(520px,70vh)] w-full flex-col items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <EmptyArt src="/blank/shared-with-me.png" />

        <h2 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
          No shared files
        </h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
          Files that others have shared with you will automatically appear here.
        </p>

        <ul className="mt-6 w-full max-w-sm space-y-3 text-left">
          {NOTHING_FEATURES.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm">
              <CircleCheckFill className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="text-foreground/90">{feature}</span>
            </li>
          ))}
        </ul>
      </div>
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
          className="mb-6 h-36 w-40 rounded-lg object-contain sm:h-40 sm:w-[16.5rem]"
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
