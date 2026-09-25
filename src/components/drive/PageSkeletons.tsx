"use client";

import { Card, Skeleton } from "@heroui/react";
import type { ReactNode } from "react";
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
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: count }, (_, i) => (
          <div
            key={`grid-${i}`}
            className="rounded-xl border border-border bg-white p-3"
          >
            <Skeleton
              animationType="none"
              className="aspect-square w-full rounded-lg"
            />
            <Skeleton
              animationType="none"
              className="mt-3 h-3.5 w-4/5 rounded"
            />
            <Skeleton animationType="none" className="mt-2 h-3 w-1/2 rounded" />
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
