"use client";

import { Card, Skeleton } from "@heroui/react";
import type { ReactNode } from "react";
import { Folder } from "@/components/folder/Folder";
import { cn } from "@/lib/utils";

function Shimmer({
  className,
  label,
  children,
}: {
  className?: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn("skeleton--shimmer relative overflow-hidden", className)}
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      {children}
    </div>
  );
}

export function FileGridSkeleton({
  count = 8,
  className,
  label = "Loading files",
}: {
  count?: number;
  className?: string;
  label?: string;
}) {
  return (
    <Shimmer className={className} label={label}>
      <div className="grid grid-cols-3 gap-x-1.5 gap-y-2 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-6 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: count }, (_, i) => (
          <div
            key={`grid-${i}`}
            className="flex flex-col overflow-hidden rounded-lg border border-transparent bg-[#f0f4f9] sm:rounded-xl dark:bg-surface-secondary"
          >
            <div className="flex items-center gap-0.5 px-1 pt-1 pb-0.5 sm:gap-1.5 sm:px-2 sm:pt-2 sm:pb-1.5">
              <Skeleton
                animationType="none"
                className="h-2.5 w-2.5 shrink-0 rounded-sm sm:h-3.5 sm:w-3.5"
              />
              <Skeleton
                animationType="none"
                className="h-2.5 min-w-0 flex-1 rounded sm:h-3"
              />
              <Skeleton
                animationType="none"
                className="h-4 w-4 shrink-0 rounded-full sm:h-6 sm:w-6"
              />
            </div>
            <div className="px-0.5 pb-0.5 sm:px-1.5 sm:pb-1.5">
              <Skeleton
                animationType="none"
                className="aspect-[4/3] w-full rounded-md sm:aspect-[5/3] sm:rounded-lg"
              />
            </div>
            <div className="flex items-center gap-0.5 px-1 pb-1 pt-0 sm:gap-1.5 sm:px-2 sm:pb-2">
              <Skeleton
                animationType="none"
                className="h-3 w-3 shrink-0 rounded-sm sm:h-3.5 sm:w-3.5"
              />
              <Skeleton
                animationType="none"
                className="h-2 w-16 max-w-[70%] rounded sm:h-2.5 sm:w-20"
              />
            </div>
          </div>
        ))}
      </div>
    </Shimmer>
  );
}

/** Same structure as `FolderGrid` xs items — real `Folder` icon + text placeholders. */
export function FolderGridSkeleton({
  count = 10,
  className,
  label = "Loading folders",
}: {
  count?: number;
  className?: string;
  label?: string;
}) {
  return (
    <Shimmer className={className} label={label}>
      <div className="grid grid-cols-3 gap-x-0.5 gap-y-0 sm:grid-cols-3 sm:gap-x-1 md:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: count }, (_, i) => (
          <div
            key={`folder-${i}`}
            className="flex min-h-0 min-w-0 flex-col items-center justify-start overflow-hidden bg-transparent px-0.5 py-0 sm:px-1.5"
          >
            <div className="pointer-events-none flex h-14 w-full shrink-0 items-end justify-center overflow-hidden sm:h-[5.5rem]">
              <div className="origin-bottom scale-[0.22] opacity-40 sm:scale-[0.3]">
                <Folder
                  color="blue"
                  size="sm"
                  open
                  interactive={false}
                  animated={false}
                />
              </div>
            </div>
            <div className="mt-0 flex w-full min-w-0 items-center justify-center gap-1 text-center leading-tight">
              <Skeleton
                animationType="none"
                className="h-3.5 w-3.5 shrink-0 rounded-sm sm:h-4 sm:w-4"
              />
              <Skeleton
                animationType="none"
                className="h-2.5 w-16 max-w-[60%] rounded sm:h-3.5 sm:w-24"
              />
            </div>
            <Skeleton
              animationType="none"
              className="mt-0.5 h-1.5 w-20 max-w-[75%] rounded sm:h-2 sm:w-28"
            />
          </div>
        ))}
      </div>
    </Shimmer>
  );
}

export function FileListSkeleton({
  count = 6,
  className,
  label = "Loading files",
}: {
  count?: number;
  className?: string;
  label?: string;
}) {
  return (
    <Shimmer className={className} label={label}>
      <div className="space-y-2">
        {Array.from({ length: count }, (_, i) => (
          <div
            key={`row-${i}`}
            className="flex items-center gap-3 rounded-xl border border-border bg-white px-3 py-3"
          >
            <Skeleton
              animationType="none"
              className="h-9 w-9 shrink-0 rounded-lg"
            />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton
                animationType="none"
                className="h-3.5 w-48 max-w-full rounded"
              />
              <Skeleton
                animationType="none"
                className="h-3 w-28 max-w-full rounded"
              />
            </div>
            <Skeleton
              animationType="none"
              className="hidden h-3 w-16 shrink-0 rounded sm:block"
            />
            <Skeleton
              animationType="none"
              className="hidden h-3 w-20 shrink-0 rounded md:block"
            />
          </div>
        ))}
      </div>
    </Shimmer>
  );
}

export function CardListSkeleton({
  count = 5,
  className,
  label = "Loading",
}: {
  count?: number;
  className?: string;
  label?: string;
}) {
  return (
    <Shimmer className={className} label={label}>
      <div className="space-y-3">
        {Array.from({ length: count }, (_, i) => (
          <div
            key={`card-${i}`}
            className="rounded-xl border border-border bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton
                  animationType="none"
                  className="h-4 w-52 max-w-full rounded"
                />
                <Skeleton
                  animationType="none"
                  className="h-3 w-40 max-w-full rounded"
                />
                <Skeleton
                  animationType="none"
                  className="h-3 w-28 max-w-full rounded"
                />
              </div>
              <Skeleton
                animationType="none"
                className="h-8 w-16 shrink-0 rounded-lg"
              />
            </div>
          </div>
        ))}
      </div>
    </Shimmer>
  );
}

export function StatCardsSkeleton({
  count = 3,
  className,
  label = "Loading stats",
}: {
  count?: number;
  className?: string;
  label?: string;
}) {
  return (
    <Shimmer className={className} label={label}>
      <div
        className={cn(
          "grid gap-3",
          count === 4
            ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
            : "grid-cols-1 sm:grid-cols-3",
        )}
      >
        {Array.from({ length: count }, (_, i) => (
          <Card
            key={`stat-${i}`}
            className="relative overflow-hidden border border-border bg-white p-5 shadow-none"
          >
            <Skeleton
              animationType="none"
              className="absolute right-4 top-4 h-9 w-9 rounded-full"
            />
            <Skeleton animationType="none" className="h-3 w-24 rounded" />
            <Skeleton
              animationType="none"
              className="mt-3 h-8 w-20 rounded-lg"
            />
            <Skeleton
              animationType="none"
              className="mt-2 h-3 w-4/5 max-w-[180px] rounded"
            />
          </Card>
        ))}
      </div>
    </Shimmer>
  );
}

export function AccountCardsSkeleton({
  count = 3,
  className,
  label = "Loading accounts",
}: {
  count?: number;
  className?: string;
  label?: string;
}) {
  return (
    <Shimmer className={className} label={label}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }, (_, i) => (
          <Card
            key={`acct-${i}`}
            className="border border-border bg-white p-5 shadow-none"
          >
            <div className="flex items-center gap-3">
              <Skeleton
                animationType="none"
                className="h-10 w-10 shrink-0 rounded-full"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton
                  animationType="none"
                  className="h-4 w-36 max-w-full rounded"
                />
                <Skeleton
                  animationType="none"
                  className="h-3 w-24 max-w-full rounded"
                />
              </div>
            </div>
            <Skeleton
              animationType="none"
              className="mt-4 h-2 w-full rounded-full"
            />
            <div className="mt-3 flex justify-between gap-2">
              <Skeleton animationType="none" className="h-3 w-20 rounded" />
              <Skeleton animationType="none" className="h-3 w-16 rounded" />
            </div>
          </Card>
        ))}
      </div>
    </Shimmer>
  );
}

export function FormPageSkeleton({
  className,
  label = "Loading",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <Shimmer className={cn("space-y-6", className)} label={label}>
      <div className="space-y-3">
        <Skeleton animationType="none" className="h-8 w-48 rounded-lg" />
        <Skeleton
          animationType="none"
          className="h-4 w-72 max-w-full rounded"
        />
      </div>
      {["block-a", "block-b", "block-c"].map((id) => (
        <Card
          key={id}
          className="space-y-4 border border-border bg-white p-5 shadow-none"
        >
          <Skeleton animationType="none" className="h-5 w-40 rounded" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton animationType="none" className="h-10 w-full rounded-xl" />
            <Skeleton animationType="none" className="h-10 w-full rounded-xl" />
          </div>
          <Skeleton animationType="none" className="h-10 w-full rounded-xl" />
        </Card>
      ))}
    </Shimmer>
  );
}

/** Mirrors `SettingsPage` layout: profile + cards + right nav. */
export function SettingsPageSkeleton({
  className,
  label = "Loading settings",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <Shimmer
      className={cn("relative flex gap-20 pb-8 lg:gap-28", className)}
      label={label}
    >
      <div className="min-w-0 flex-1 space-y-5">
        <div className="scroll-mt-24">
          <div className="mt-1.5 space-y-2 sm:mt-3.5">
            <Skeleton
              animationType="none"
              className="h-8 w-28 rounded-lg sm:h-9"
            />
            <Skeleton
              animationType="none"
              className="h-4 w-80 max-w-full rounded"
            />
          </div>

          <div className="mt-5">
            <Skeleton animationType="none" className="h-6 w-44 rounded" />

            <div className="mt-5 flex flex-col gap-2">
              <Skeleton animationType="none" className="size-24 rounded-full" />
              <Skeleton animationType="none" className="h-4 w-40 rounded" />
            </div>

            <div className="mt-6 grid items-start gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.55fr)]">
              {["first", "last", "email"].map((id) => (
                <div key={id} className="grid min-w-0 gap-1.5">
                  <Skeleton animationType="none" className="h-5 w-24 rounded" />
                  <Skeleton
                    animationType="none"
                    className="h-10 w-full rounded-xl"
                  />
                  <Skeleton
                    animationType="none"
                    className="h-4 w-full rounded"
                  />
                </div>
              ))}
            </div>
            <Skeleton
              animationType="none"
              className="mt-5 h-10 w-32 rounded-xl"
            />
          </div>
        </div>

        <div className="scroll-mt-24 space-y-3 rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6">
          <Skeleton animationType="none" className="h-6 w-36 rounded" />
          <Skeleton
            animationType="none"
            className="h-4 w-64 max-w-full rounded"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton animationType="none" className="h-10 w-full rounded-xl" />
            <Skeleton animationType="none" className="h-10 w-full rounded-xl" />
          </div>
          <Skeleton animationType="none" className="h-10 w-36 rounded-xl" />
        </div>

        <div className="pt-4 space-y-2">
          <Skeleton animationType="none" className="h-8 w-32 rounded-lg" />
          <Skeleton
            animationType="none"
            className="h-4 w-96 max-w-full rounded"
          />
        </div>

        {["subscription", "smart", "newsletter", "notifications"].map((id) => (
          <div
            key={id}
            className="space-y-3 rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6"
          >
            <Skeleton animationType="none" className="h-5 w-48 rounded" />
            <Skeleton
              animationType="none"
              className="h-4 w-full max-w-md rounded"
            />
            <Skeleton animationType="none" className="h-16 w-full rounded-xl" />
          </div>
        ))}

        <div className="space-y-4 rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <Skeleton animationType="none" className="h-6 w-48 rounded" />
              <Skeleton animationType="none" className="h-4 w-56 rounded" />
            </div>
            <Skeleton
              animationType="none"
              className="h-10 w-36 shrink-0 rounded-xl"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {["a", "b", "c"].map((id) => (
              <div
                key={id}
                className="rounded-2xl border border-border bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <Skeleton
                    animationType="none"
                    className="h-8 w-8 rounded-lg"
                  />
                  <div className="flex gap-1">
                    <Skeleton
                      animationType="none"
                      className="h-8 w-8 rounded-lg"
                    />
                    <Skeleton
                      animationType="none"
                      className="h-8 w-8 rounded-lg"
                    />
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <Skeleton animationType="none" className="h-4 w-32 rounded" />
                  <Skeleton animationType="none" className="h-3 w-24 rounded" />
                  <Skeleton animationType="none" className="h-3 w-40 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <aside className="hidden w-40 shrink-0 lg:block">
        <div className="sticky top-24 space-y-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton
              key={`nav-${i}`}
              animationType="none"
              className="h-5 w-28 rounded"
            />
          ))}
        </div>
      </aside>
    </Shimmer>
  );
}

export function SectionSkeleton({
  rows = 3,
  className,
  label = "Loading",
}: {
  rows?: number;
  className?: string;
  label?: string;
}) {
  return (
    <Shimmer className={cn("space-y-2", className)} label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton
          key={`sec-${i}`}
          animationType="none"
          className={cn("h-4 rounded", i === 0 ? "w-40" : "w-full")}
        />
      ))}
    </Shimmer>
  );
}
