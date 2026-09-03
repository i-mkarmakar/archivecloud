"use client";

import {
  ArrowRotateRight,
  Calendar,
  ChevronRight,
  CircleCheck,
  Clock,
  Magnifier,
  SquareExclamation,
  TriangleExclamation,
} from "@gravity-ui/icons";
import { Button, Card, Skeleton, toast } from "@heroui/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { PageHeader } from "@/components/drive/PageHeader";
import { useRouter } from "next/navigation";
import { apiFetch, formatBytes, formatDate } from "@/lib/api";
import { cn } from "@/lib/utils";

type TransferJob = {
  id: string;
  type: string;
  status: string;
  fileName: string;
  sizeBytes: string;
  transferredBytes: string;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  sourceAccountEmail: string | null;
  destAccountEmail: string | null;
};

type ScheduledTaskOption = {
  id: string;
  fileName: string;
};

type StatusFilter = "all" | "succeeded" | "partial" | "failed" | "running";
type OpFilter = "all" | "move" | "copy" | "delete";
type RangeFilter = "30d" | "7d" | "24h" | "all";

function mapUiStatus(status: string): Exclude<StatusFilter, "all" | "partial"> {
  if (status === "completed") return "succeeded";
  if (status === "failed") return "failed";
  return "running";
}

function withinRange(iso: string, range: RangeFilter) {
  if (range === "all") return true;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const ms =
    range === "24h"
      ? 24 * 60 * 60 * 1000
      : range === "7d"
        ? 7 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000;
  return Date.now() - t <= ms;
}

function rangeLabel(range: RangeFilter) {
  if (range === "24h") return "Last 24h";
  if (range === "7d") return "Last 7 days";
  if (range === "all") return "All time";
  return "Last 30 days";
}

function StatCard({
  label,
  value,
  hint,
  valueClassName,
  icon,
  iconClassName,
}: {
  label: string;
  value: string;
  hint: string;
  valueClassName?: string;
  icon: ReactNode;
  iconClassName: string;
}) {
  return (
    <Card className="relative overflow-hidden border border-border bg-white p-5 shadow-none">
      <div
        className={cn(
          "absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl",
          iconClassName,
        )}
      >
        {icon}
      </div>
      <p className="pr-12 text-[11px] font-bold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p
        className={cn(
          "mt-3 text-3xl font-extrabold tracking-tight text-foreground",
          valueClassName,
        )}
      >
        {value}
      </p>
      <p className="mt-2 text-sm text-muted">{hint}</p>
    </Card>
  );
}

function FilterPill({
  active,
  onClick,
  children,
  tone = "solid",
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  tone?: "solid" | "soft";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
        active && tone === "solid"
          ? "border-foreground bg-foreground text-white"
          : active && tone === "soft"
            ? "border-border bg-white text-foreground shadow-sm"
            : "border-transparent bg-surface-secondary text-muted hover:bg-white hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function statusChip(status: string) {
  if (status === "completed")
    return "bg-success-soft text-success-soft-foreground";
  if (status === "failed") return "bg-danger-soft text-danger-soft-foreground";
  if (status === "running" || status === "queued")
    return "bg-warning-soft text-warning-soft-foreground";
  return "bg-surface-secondary text-muted";
}

export function RunHistoryPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<TransferJob[]>([]);
  const [schedules, setSchedules] = useState<ScheduledTaskOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [error, setError] = useState("");
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [opFilter, setOpFilter] = useState<OpFilter>("all");
  const [scheduleId, setScheduleId] = useState("all");
  const [range, setRange] = useState<RangeFilter>("30d");
  const [query, setQuery] = useState("");

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError("");
    try {
      const [jobsRes, schedulesRes] = await Promise.all([
        apiFetch<{ jobs: TransferJob[] }>("/transfers?limit=100"),
        apiFetch<{ tasks: ScheduledTaskOption[] }>("/automation/scheduled").catch(
          () => ({ tasks: [] as ScheduledTaskOption[] }),
        ),
      ]);
      setJobs(jobsRes.jobs);
      setSchedules(
        schedulesRes.tasks.map((t) => ({ id: t.id, fileName: t.fileName })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
    const timer = window.setInterval(() => {
      load({ silent: true }).catch(() => undefined);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function refresh() {
    setRefreshBusy(true);
    try {
      await load();
      toast.success("Run history refreshed.");
    } finally {
      setRefreshBusy(false);
    }
  }

  async function retryJob(id: string) {
    setRetryingId(id);
    try {
      await apiFetch(`/transfers/${id}/retry`, { method: "POST" });
      toast.success("Transfer queued again");
      await load({ silent: true });
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setRetryingId(null);
    }
  }

  function resetFilters() {
    setStatusFilter("all");
    setOpFilter("all");
    setScheduleId("all");
    setRange("30d");
    setQuery("");
  }

  const jobsInRange = useMemo(
    () => jobs.filter((job) => withinRange(job.createdAt, range)),
    [jobs, range],
  );

  const selectedScheduleName = useMemo(() => {
    if (scheduleId === "all") return null;
    return schedules.find((s) => s.id === scheduleId)?.fileName ?? null;
  }, [scheduleId, schedules]);

  const scopedJobs = useMemo(() => {
    if (!selectedScheduleName) return jobsInRange;
    const needle = selectedScheduleName.toLowerCase();
    return jobsInRange.filter((job) =>
      job.fileName.toLowerCase().includes(needle),
    );
  }, [jobsInRange, selectedScheduleName]);

  const counts = useMemo(() => {
    const base = {
      all: scopedJobs.length,
      succeeded: 0,
      partial: 0,
      failed: 0,
      running: 0,
      move: 0,
      copy: 0,
      delete: 0,
      opsAll: scopedJobs.length,
    };
    for (const job of scopedJobs) {
      const ui = mapUiStatus(job.status);
      base[ui] += 1;
      if (job.type === "move" || job.type === "copy" || job.type === "delete") {
        base[job.type] += 1;
      }
    }
    return base;
  }, [scopedJobs]);

  const stats = useMemo(() => {
    const total = scopedJobs.length;
    const succeeded = counts.succeeded;
    const failed = counts.failed;
    const succeededPct =
      total === 0 ? 0 : Math.round((succeeded / total) * 100);
    const processedItems = scopedJobs.reduce((sum, job) => {
      if (job.status === "completed" || job.status === "failed") return sum + 1;
      return sum;
    }, 0);

    return {
      total,
      succeeded,
      succeededPct,
      partial: counts.partial,
      failed,
      processedItems,
      rangeHint:
        range === "30d"
          ? "Last 30d"
          : range === "7d"
            ? "Last 7d"
            : range === "24h"
              ? "Last 24h"
              : "All time",
    };
  }, [scopedJobs, counts, range]);

  const filteredJobs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scopedJobs.filter((job) => {
      const ui = mapUiStatus(job.status);
      if (statusFilter === "partial") return false;
      if (statusFilter !== "all" && ui !== statusFilter) return false;
      if (opFilter !== "all" && job.type !== opFilter) return false;
      if (!q) return true;
      return (
        job.fileName.toLowerCase().includes(q) ||
        (job.sourceAccountEmail ?? "").toLowerCase().includes(q) ||
        (job.destAccountEmail ?? "").toLowerCase().includes(q) ||
        job.type.toLowerCase().includes(q) ||
        job.status.toLowerCase().includes(q)
      );
    });
  }, [scopedJobs, statusFilter, opFilter, query]);

  const filtersActive =
    statusFilter !== "all" ||
    opFilter !== "all" ||
    scheduleId !== "all" ||
    range !== "30d" ||
    query.trim().length > 0;

  const showEmpty =
    !loading &&
    !error &&
    jobs.length === 0 &&
    !filtersActive;

  const showNoMatches =
    !loading &&
    !error &&
    !showEmpty &&
    filteredJobs.length === 0;

  return (
    <>
      <PageHeader
        title={
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <button
              type="button"
              className="truncate text-muted transition-colors hover:text-foreground"
              onClick={() => router.push("/automation?view=schedule")}
            >
              Schedule Tasks
            </button>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
            <span className="truncate">Run History</span>
          </span>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            isDisabled={refreshBusy || loading}
            onPress={() => refresh().catch(() => undefined)}
          >
            <ArrowRotateRight
              className={cn("h-4 w-4", refreshBusy && "animate-spin")}
            />
            Refresh
          </Button>
        }
      />

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Runs in Window"
          value={String(stats.total)}
          hint={stats.rangeHint}
          icon={<Calendar className="h-4 w-4" />}
          iconClassName="bg-[#e8f1ff] text-[#1877f2]"
        />
        <StatCard
          label="Succeeded"
          value={String(stats.succeeded)}
          hint={`${stats.succeededPct}% of runs`}
          icon={<CircleCheck className="h-4 w-4" />}
          iconClassName="bg-[#e8f8ef] text-[#1b7a45]"
        />
        <StatCard
          label="Partial"
          value={String(stats.partial)}
          hint="Some files failed"
          icon={<TriangleExclamation className="h-4 w-4" />}
          iconClassName="bg-[#fff6db] text-[#c48a00]"
        />
        <StatCard
          label="Failed"
          value={String(stats.failed)}
          hint={`${stats.processedItems} items processed total`}
          valueClassName="text-[#e53935]"
          icon={<SquareExclamation className="h-4 w-4" />}
          iconClassName="bg-[#fdecea] text-[#e53935]"
        />
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["all", "All"],
                ["succeeded", "Succeeded"],
                ["partial", "Partial"],
                ["failed", "Failed"],
                ["running", "Running"],
              ] as const
            ).map(([id, label]) => (
              <FilterPill
                key={id}
                active={statusFilter === id}
                tone="soft"
                onClick={() => setStatusFilter(id)}
              >
                {label} {counts[id]}
              </FilterPill>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["all", "All ops", counts.opsAll],
                ["move", "Move", counts.move],
                ["copy", "Copy", counts.copy],
                ["delete", "Delete", counts.delete],
              ] as const
            ).map(([id, label, count]) => (
              <FilterPill
                key={id}
                active={opFilter === id}
                onClick={() => setOpFilter(id)}
              >
                {label} {count}
              </FilterPill>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative inline-flex min-w-[200px] flex-1 items-center lg:max-w-[240px]">
            <Calendar className="pointer-events-none absolute left-3 h-4 w-4 text-muted" />
            <select
              className="h-10 w-full appearance-none rounded-xl border border-border bg-white py-2 pl-9 pr-8 text-sm font-semibold"
              value={scheduleId}
              onChange={(e) => setScheduleId(e.target.value)}
              aria-label="Filter by schedule"
            >
              <option value="all">Schedule: All schedules</option>
              {schedules.map((schedule) => (
                <option key={schedule.id} value={schedule.id}>
                  {schedule.fileName}
                </option>
              ))}
            </select>
          </label>

          <label className="relative inline-flex min-w-[180px] flex-1 items-center lg:max-w-[220px]">
            <Clock className="pointer-events-none absolute left-3 h-4 w-4 text-muted" />
            <select
              className="h-10 w-full appearance-none rounded-xl border border-border bg-white py-2 pl-9 pr-8 text-sm font-semibold"
              value={range}
              onChange={(e) => setRange(e.target.value as RangeFilter)}
              aria-label="Filter by date range"
            >
              <option value="30d">Range: Last 30 days</option>
              <option value="7d">Range: Last 7 days</option>
              <option value="24h">Range: Last 24 hours</option>
              <option value="all">Range: All time</option>
            </select>
          </label>

          <div className="relative min-w-0 flex-1">
            <Magnifier className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              className="h-10 w-full rounded-xl border border-border bg-white py-2 pr-3 pl-9 text-sm outline-none focus:border-foreground/30"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search runs..."
              aria-label="Search runs"
            />
          </div>

          <button
            type="button"
            className={cn(
              "shrink-0 text-sm font-semibold transition-colors",
              filtersActive
                ? "text-foreground hover:text-muted"
                : "cursor-default text-muted/60",
            )}
            disabled={!filtersActive}
            onClick={resetFilters}
          >
            Reset
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-border bg-white">
        {loading && jobs.length === 0 ? (
          <div
            className="skeleton--shimmer relative space-y-3 overflow-hidden p-4"
            role="status"
            aria-busy="true"
            aria-label="Loading run history"
          >
            {["r-a", "r-b", "r-c", "r-d", "r-e"].map((id) => (
              <div
                key={id}
                className="rounded-xl border border-border bg-surface-secondary p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton
                      animationType="none"
                      className="h-4 w-56 max-w-full rounded"
                    />
                    <Skeleton
                      animationType="none"
                      className="h-3 w-36 max-w-full rounded"
                    />
                  </div>
                  <Skeleton
                    animationType="none"
                    className="h-6 w-16 shrink-0 rounded-full"
                  />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center px-6 py-12 text-center">
            <p className="font-extrabold text-foreground">Couldn’t load runs</p>
            <p className="mt-1 text-sm text-danger">{error}</p>
            <Button
              className="mt-4"
              variant="outline"
              onPress={() => load().catch(() => undefined)}
            >
              Try again
            </Button>
          </div>
        ) : showEmpty ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#e8f1ff] text-[#1877f2]">
              <ArrowRotateRight className="h-7 w-7" />
            </div>
            <h2 className="mt-5 text-xl font-extrabold tracking-tight text-foreground">
              No runs yet
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
              Runs appear here as soon as your schedules start firing. Each run
              is recorded with a full per-file audit trail.
            </p>
          </div>
        ) : showNoMatches ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center px-6 py-12 text-center">
            <p className="font-extrabold text-foreground">No matching runs</p>
            <p className="mt-1 text-sm text-muted">
              Nothing in {rangeLabel(range).toLowerCase()} matches these
              filters.
            </p>
            <button
              type="button"
              className="mt-3 text-sm font-semibold text-foreground underline-offset-4 hover:underline"
              onClick={resetFilters}
            >
              Reset filters
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-extrabold text-foreground">
                      {job.fileName}
                    </p>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-bold capitalize",
                        statusChip(job.status),
                      )}
                    >
                      {mapUiStatus(job.status)}
                    </span>
                    <span className="rounded-full bg-surface-secondary px-2 py-0.5 text-xs font-bold capitalize text-muted">
                      {job.type}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {job.sourceAccountEmail ?? "Source"} →{" "}
                    {job.destAccountEmail ?? "Destination"}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {formatBytes(job.sizeBytes)} · queued{" "}
                    {formatDate(job.createdAt)}
                    {job.completedAt
                      ? ` · finished ${formatDate(job.completedAt)}`
                      : ""}
                  </p>
                  {job.errorMessage ? (
                    <p className="mt-2 text-sm text-danger">{job.errorMessage}</p>
                  ) : null}
                </div>
                {job.status === "failed" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    isDisabled={retryingId === job.id}
                    onPress={() => retryJob(job.id).catch(() => undefined)}
                  >
                    {retryingId === job.id ? "Retrying…" : "Retry"}
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
