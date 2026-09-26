"use client";

import { formatBytes } from "@/lib/api";

/** Soft scale so unlimited plans still show a visible fill for small usage. */
const UNLIMITED_BAR_BYTES = 100 * 1024 * 1024 * 1024; // 100 GB

function toByteNumber(value: string | number | bigint | null | undefined) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "bigint") {
    const asNumber = Number(value);
    return Number.isFinite(asNumber) ? asNumber : 0;
  }
  const asNumber = typeof value === "number" ? value : Number(value);
  return Number.isFinite(asNumber) ? asNumber : 0;
}

export function SidebarPlanLimits({
  transferUsedBytes,
  transferLimitBytes,
}: {
  transferUsedBytes: string | number | bigint;
  transferLimitBytes: string | number | bigint | null;
}) {
  const bandwidthUsed = toByteNumber(transferUsedBytes);
  const unlimitedBandwidth = transferLimitBytes === null;
  const bandwidthLimit = unlimitedBandwidth
    ? 0
    : toByteNumber(transferLimitBytes);
  const bandwidthRemaining = unlimitedBandwidth
    ? null
    : Math.max(0, bandwidthLimit - bandwidthUsed);

  const barTotal = unlimitedBandwidth
    ? UNLIMITED_BAR_BYTES
    : Math.max(bandwidthLimit, 1);

  let usedPct =
    barTotal > 0 ? Math.min(100, (bandwidthUsed / barTotal) * 100) : 0;
  // Keep a visible sliver whenever anything has been used.
  if (bandwidthUsed > 0 && usedPct < 1) usedPct = 1;

  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
        Bandwidth
      </p>
      <div className="flex min-w-0 justify-between gap-2 text-sm font-bold text-foreground">
        <span className="min-w-0 truncate">
          {formatBytes(transferUsedBytes)} used
        </span>
        <span className="shrink-0 text-muted">
          {unlimitedBandwidth
            ? "Unlimited"
            : `${formatBytes(bandwidthRemaining)} free`}
        </span>
      </div>
      <div
        className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-surface-secondary"
        role="progressbar"
        aria-label="Monthly bandwidth usage"
        aria-valuemin={0}
        aria-valuemax={Math.round(barTotal)}
        aria-valuenow={Math.round(bandwidthUsed)}
      >
        <div
          className="h-full shrink-0 rounded-full bg-success transition-[width] duration-300 ease-out"
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
