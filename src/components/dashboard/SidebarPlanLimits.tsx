"use client";

import { formatBytes } from "@/lib/api";
import type { PlanDefinition } from "@/lib/plans";
import { cn } from "@/lib/utils";

export function SidebarPlanLimits({
  plan,
  transferUsedBytes,
  transferLimitBytes,
  storageUsedBytes,
  storageAvailableBytes,
  connectedAccounts,
}: {
  plan: PlanDefinition;
  transferUsedBytes: string | number | bigint;
  transferLimitBytes: string | number | bigint | null;
  storageUsedBytes: string | number | bigint;
  storageAvailableBytes: string | number | bigint | null;
  connectedAccounts: number;
}) {
  const bandwidthUsed = Number(transferUsedBytes) || 0;
  const unlimitedBandwidth = transferLimitBytes === null;
  const bandwidthLimit = unlimitedBandwidth
    ? 0
    : Number(transferLimitBytes) || 0;
  const bandwidthRemaining = unlimitedBandwidth
    ? null
    : bandwidthLimit > bandwidthUsed
      ? bandwidthLimit - bandwidthUsed
      : 0;

  const accountLimit = plan.limits.maxCloudAccounts;
  const accountsValue = accountLimit
    ? `${connectedAccounts} / ${accountLimit}`
    : `${connectedAccounts} · unlimited`;

  const rows = [
    {
      label: "Cloud accounts",
      value: accountsValue,
      dotClass: "bg-accent",
    },
    {
      label: "Drive storage",
      value: formatBytes(storageUsedBytes),
      dotClass: "bg-warning",
    },
    {
      label: "Drive free",
      value:
        storageAvailableBytes === null || storageAvailableBytes === undefined
          ? "Unlimited"
          : formatBytes(storageAvailableBytes),
      dotClass: "bg-muted-foreground/70",
    },
  ];

  const barTotal = unlimitedBandwidth
    ? Math.max(bandwidthUsed, 1)
    : bandwidthLimit > 0
      ? bandwidthLimit
      : Math.max(bandwidthUsed, 1);
  const usedPct = unlimitedBandwidth
    ? 0
    : barTotal > 0
      ? Math.min(100, (bandwidthUsed / barTotal) * 100)
      : 0;

  return (
    <div className="min-w-0">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
        Plan limits · {plan.name}
      </p>
      <div className="mb-3 space-y-2">
        {rows.map((item) => (
          <div
            key={item.label}
            className="flex min-w-0 items-center justify-between gap-2 text-xs text-muted"
          >
            <span className="flex min-w-0 items-center gap-2 font-medium">
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  item.dotClass,
                )}
              />
              <span className="truncate">{item.label}</span>
            </span>
            <span className="shrink-0 font-semibold text-foreground">
              {item.value}
            </span>
          </div>
        ))}
      </div>

      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
        Bandwidth
      </p>
      <div className="flex min-w-0 justify-between gap-2 text-sm font-bold text-foreground">
        <span className="min-w-0 truncate">
          {formatBytes(transferUsedBytes)} used
        </span>
        <span className="shrink-0 text-muted">
          {unlimitedBandwidth
            ? "Unlimited free"
            : `${formatBytes(bandwidthRemaining ?? 0)} free`}
        </span>
      </div>
      <div
        className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-surface-secondary"
        role="progressbar"
        aria-label="Monthly bandwidth usage"
        aria-valuemin={0}
        aria-valuemax={barTotal}
        aria-valuenow={bandwidthUsed}
      >
        <div
          className="h-full shrink-0 bg-success"
          style={{ width: `${usedPct}%` }}
          title={
            unlimitedBandwidth
              ? `Bandwidth: ${formatBytes(transferUsedBytes)} (unlimited)`
              : `Bandwidth: ${formatBytes(transferUsedBytes)} of ${formatBytes(transferLimitBytes ?? 0)}`
          }
        />
      </div>
    </div>
  );
}
