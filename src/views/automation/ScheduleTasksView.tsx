"use client";

import {
  ArrowRotateRight,
  ArrowUpArrowDown,
  Calendar,
  Clock,
  ClockArrowRotateLeft,
  Magnifier,
  Plus,
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
import { NewScheduleModal } from "@/components/automation/new-schedule";
import { PageHeader } from "@/components/drive/PageHeader";
import { UpgradePlanModal } from "@/components/drive/UpgradePlanModal";
import { useWorkspaceFiles } from "@/hooks/useWorkspaceFiles";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useUserPlan } from "@/hooks/useUserPlan";
import { isSupportedProviderId } from "@/lib/providers";
import { cn } from "@/lib/utils";

type ConnectedAccount = {
  id: string;
  email: string;
  displayName?: string | null;
  provider: string;
};

type ScheduledTask = {
  id: string;
  status: string;
  operation: string;
  scheduleKind: string;
  nextRunAt: string;
  lastRunAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  fileName: string;
  sizeBytes: string;
  sourceAccountEmail: string | null;
  destAccountEmail: string | null;
  destParentId: string | null;
};

type StatusFilter =
  | "all"
  | "scheduled"
  | "failed"
  | "paused"
  | "completed"
  | "deleted";

type OpFilter = "all" | "move" | "copy" | "delete";
type SortMode = "created_desc" | "next_run_asc" | "name_asc";

function humanScheduleKind(kind: string) {
  if (kind === "once") return "Once";
  if (kind === "daily") return "Daily";
  if (kind === "weekly") return "Weekly";
  if (kind === "monthly") return "Monthly";
  return kind;
}

function mapUiStatus(status: string): StatusFilter {
  if (status === "active") return "scheduled";
  if (status === "failed") return "failed";
  if (status === "paused") return "paused";
  if (status === "completed") return "completed";
  if (status === "cancelled" || status === "deleted") return "deleted";
  return "all";
}

function withinMs(iso: string | null, ms: number) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= ms;
}

function formatNextRun(iso: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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

export function ScheduleTasksView() {
  const router = useRouter();
  const {
    files,
    loading: filesLoading,
    reload: reloadFiles,
  } = useWorkspaceFiles("default", 200);

  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);

  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [opFilter, setOpFilter] = useState<OpFilter>("all");
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("created_desc");

  const { planId, hasFeature, canUpgrade, loaded: planLoaded } = useUserPlan();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const hasAutomation = hasFeature("automation");

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const data = await apiFetch<{ accounts: ConnectedAccount[] }>(
        "/connected-accounts",
      );
      const supported = data.accounts.filter((a) =>
        isSupportedProviderId(a.provider),
      );
      setAccounts(supported);
    } catch {
      setAccounts([]);
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const data = await apiFetch<{ tasks: ScheduledTask[] }>(
        "/automation/scheduled",
      );
      setTasks(data.tasks);
    } catch (err) {
      toast.danger(
        err instanceof Error ? err.message : "Failed to load scheduled tasks",
      );
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts().catch(() => undefined);
    loadTasks().catch(() => undefined);
  }, [loadAccounts, loadTasks]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      apiFetch("/automation/tick", { method: "POST" }).catch(() => undefined);
    }, 20_000);
    return () => window.clearInterval(timer);
  }, []);

  async function refreshAll() {
    setRefreshBusy(true);
    try {
      await apiFetch("/automation/tick", { method: "POST" }).catch(
        () => undefined,
      );
      await loadTasks();
      toast.success("Schedule list refreshed.");
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshBusy(false);
    }
  }

  function openCreate() {
    if (!hasAutomation) {
      if (canUpgrade) {
        setUpgradeOpen(true);
        return;
      }
      toast.danger(
        "Scheduled automation is a Thunder feature. Ask your administrator to enable it for your account.",
      );
      return;
    }
    setCreateOpen(true);
  }

  async function createTask(payload: {
    sourceFileId: string;
    destAccountId?: string;
    destParentId: string | null;
    operation: "copy" | "move" | "delete";
    scheduleKind: "once" | "daily" | "weekly" | "monthly";
    startAt: string;
    name: string;
  }) {
    if (!hasAutomation) {
      if (canUpgrade) setUpgradeOpen(true);
      return;
    }

    setCreating(true);
    try {
      await apiFetch("/automation/scheduled", {
        method: "POST",
        body: JSON.stringify({
          sourceFileId: payload.sourceFileId,
          destAccountId:
            payload.operation === "delete" ? undefined : payload.destAccountId,
          operation: payload.operation,
          scheduleKind: payload.scheduleKind,
          startAt: payload.startAt,
          destParentId: payload.destParentId,
        }),
      });
      toast.success(
        payload.name.trim()
          ? `Scheduled “${payload.name.trim()}”.`
          : "Scheduled transfer created.",
      );
      setCreateOpen(false);
      await reloadFiles();
      await loadTasks();
    } catch (err) {
      toast.danger(
        err instanceof Error ? err.message : "Failed to create task",
      );
    } finally {
      setCreating(false);
    }
  }

  const counts = useMemo(() => {
    const base = {
      all: tasks.length,
      scheduled: 0,
      failed: 0,
      paused: 0,
      completed: 0,
      deleted: 0,
    };
    for (const task of tasks) {
      const key = mapUiStatus(task.status);
      if (key !== "all") base[key] += 1;
    }
    return base;
  }, [tasks]);

  const stats = useMemo(() => {
    const active = tasks.filter((t) => t.status === "active");
    const nextRun = active
      .map((t) => new Date(t.nextRunAt).getTime())
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => a - b)[0];
    const failed7d = tasks.filter(
      (t) =>
        t.status === "failed" &&
        withinMs(t.completedAt ?? t.lastRunAt, 7 * 24 * 60 * 60 * 1000),
    ).length;
    const runs24h = tasks.filter((t) =>
      withinMs(t.lastRunAt, 24 * 60 * 60 * 1000),
    ).length;

    return {
      activeCount: active.length,
      nextRunLabel: nextRun
        ? formatNextRun(new Date(nextRun).toISOString())
        : "—",
      nextRunHint:
        active.length === 0
          ? "No upcoming runs"
          : nextRun
            ? "Earliest upcoming run"
            : "No upcoming runs",
      activeHint:
        active.length === 0
          ? "No schedules yet. Create your first one"
          : `${active.length} active schedule${active.length === 1 ? "" : "s"}`,
      failed7d,
      failedHint: failed7d === 0 ? "All clear" : "Needs attention",
      runs24h,
      runsHint:
        runs24h === 0
          ? "No runs in the last 24h"
          : `${runs24h} run${runs24h === 1 ? "" : "s"} completed`,
    };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = tasks.filter((task) => {
      const uiStatus = mapUiStatus(task.status);
      if (statusFilter !== "all" && uiStatus !== statusFilter) return false;
      if (opFilter !== "all" && task.operation !== opFilter) return false;
      if (!q) return true;
      return (
        task.fileName.toLowerCase().includes(q) ||
        (task.sourceAccountEmail ?? "").toLowerCase().includes(q) ||
        (task.destAccountEmail ?? "").toLowerCase().includes(q) ||
        task.operation.toLowerCase().includes(q) ||
        task.status.toLowerCase().includes(q)
      );
    });

    list.sort((a, b) => {
      if (sortMode === "name_asc") {
        return a.fileName.localeCompare(b.fileName);
      }
      if (sortMode === "next_run_asc") {
        return (
          new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime()
        );
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return list;
  }, [tasks, statusFilter, opFilter, query, sortMode]);

  const showEmpty =
    !tasksLoading &&
    tasks.length === 0 &&
    statusFilter === "all" &&
    opFilter === "all" &&
    !query.trim();

  return (
    <>
      <PageHeader
        title="Schedule Tasks"
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              isDisabled={refreshBusy}
              onPress={() => refreshAll().catch(() => undefined)}
            >
              <ArrowRotateRight
                className={cn("h-4 w-4", refreshBusy && "animate-spin")}
              />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onPress={() => router.push("/run-history")}
            >
              <ClockArrowRotateLeft className="h-4 w-4" />
              Run history
            </Button>
            <Button size="sm" variant="primary" onPress={openCreate}>
              <Plus className="h-4 w-4" />
              New schedule
            </Button>
          </div>
        }
      />

      {planLoaded && !hasAutomation ? (
        <Card className="mt-6 border-primary/30 bg-primary/5 p-5">
          <p className="font-extrabold text-foreground">
            Automation is a Thunder feature
          </p>
          <p className="mt-1 text-sm text-muted">
            {canUpgrade
              ? "Unlock scheduled jobs, folder sync, and real-time sync with a $9 lifetime upgrade."
              : "Thunder features on this instance are managed by your administrator."}
          </p>
          {canUpgrade ? (
            <Button
              className="mt-4 rounded-full"
              variant="primary"
              onPress={() => setUpgradeOpen(true)}
            >
              Get Lifetime Access for $9
            </Button>
          ) : null}
        </Card>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active Schedules"
          value={String(stats.activeCount)}
          hint={stats.activeHint}
          icon={<Calendar className="h-4 w-4" />}
          iconClassName="bg-primary/10 text-primary"
        />
        <StatCard
          label="Next Run"
          value={stats.nextRunLabel}
          hint={stats.nextRunHint}
          icon={<Clock className="h-4 w-4" />}
          iconClassName="bg-[#fff6db] text-[#c48a00]"
        />
        <StatCard
          label="Failed Last 7D"
          value={String(stats.failed7d)}
          hint={stats.failedHint}
          valueClassName="text-[#e53935]"
          icon={<TriangleExclamation className="h-4 w-4" />}
          iconClassName="bg-[#fdecea] text-[#e53935]"
        />
        <StatCard
          label="Runs in Last 24H"
          value={String(stats.runs24h)}
          hint={stats.runsHint}
          icon={<Clock className="h-4 w-4" />}
          iconClassName="bg-[#e8f8ef] text-[#1b7a45]"
        />
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["all", "All"],
                ["scheduled", "Scheduled"],
                ["failed", "Failed"],
                ["paused", "Paused"],
                ["completed", "Completed"],
                ["deleted", "Deleted"],
              ] as const
            ).map(([id, label]) => (
              <FilterPill
                key={id}
                active={statusFilter === id}
                tone="soft"
                onClick={() => setStatusFilter(id)}
              >
                {id === "failed" ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-[#e53935]" />
                ) : null}
                {label} {counts[id]}
              </FilterPill>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["all", "Both ops"],
                ["move", "Move"],
                ["copy", "Copy"],
                ["delete", "Delete"],
              ] as const
            ).map(([id, label]) => (
              <FilterPill
                key={id}
                active={opFilter === id}
                onClick={() => setOpFilter(id)}
              >
                {label}
              </FilterPill>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <Magnifier className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              className="h-10 w-full rounded-xl border border-border bg-white py-2 pr-3 pl-9 text-sm outline-none focus:border-foreground/30"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter list..."
              aria-label="Filter scheduled tasks"
            />
          </div>
          <label className="relative inline-flex min-w-[220px] items-center">
            <ArrowUpArrowDown className="pointer-events-none absolute left-3 h-4 w-4 text-muted" />
            <select
              className="h-10 w-full appearance-none rounded-xl border border-border bg-white py-2 pl-9 pr-8 text-sm font-semibold"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              aria-label="Sort scheduled tasks"
            >
              <option value="created_desc">Sort Recently created</option>
              <option value="next_run_asc">Sort Next run</option>
              <option value="name_asc">Sort Name</option>
            </select>
          </label>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-border bg-white">
        {tasksLoading ? (
          <div
            className="skeleton--shimmer relative space-y-3 overflow-hidden p-4"
            role="status"
            aria-busy="true"
            aria-label="Loading schedules"
          >
            {["s-a", "s-b", "s-c", "s-d"].map((id) => (
              <div
                key={id}
                className="rounded-xl border border-border bg-surface-secondary p-4"
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
                    className="h-8 w-20 shrink-0 rounded-lg"
                  />
                </div>
              </div>
            ))}
          </div>
        ) : showEmpty ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ArrowRotateRight className="h-7 w-7" />
            </div>
            <h2 className="mt-5 text-xl font-extrabold tracking-tight text-foreground">
              No scheduled tasks yet
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
              Automate Move and Copy operations across your connected clouds.
              Create a schedule once and Archive Cloud will run it on your
              behalf. Every run is recorded with a full per-file audit trail.
            </p>
            <Button className="mt-6" variant="primary" onPress={openCreate}>
              <Plus className="h-4 w-4" />
              New schedule
            </Button>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center px-6 py-12 text-center">
            <p className="font-extrabold text-foreground">No matching tasks</p>
            <p className="mt-1 text-sm text-muted">
              Try a different status, operation, or search filter.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-extrabold text-foreground">
                    {task.fileName}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {humanScheduleKind(task.scheduleKind)} · Next:{" "}
                    {formatNextRun(task.nextRunAt)}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {task.operation === "delete"
                      ? "Delete"
                      : task.operation === "move"
                        ? "Move"
                        : "Copy"}{" "}
                    · {task.sourceAccountEmail ?? "Source"}
                    {task.operation === "delete"
                      ? null
                      : ` → ${task.destAccountEmail ?? "Destination"}`}
                  </p>
                  {task.errorMessage ? (
                    <p className="mt-2 text-sm text-danger-soft-foreground">
                      {task.errorMessage}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-surface-secondary px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-muted">
                    {mapUiStatus(task.status)}
                  </span>
                  {task.status === "active" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => {
                        apiFetch(`/automation/scheduled/${task.id}`, {
                          method: "DELETE",
                        })
                          .then(() => {
                            toast.success("Task cancelled.");
                            loadTasks().catch(() => undefined);
                          })
                          .catch((err) =>
                            toast.danger(
                              err instanceof Error
                                ? err.message
                                : "Cancel failed",
                            ),
                          );
                      }}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <NewScheduleModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        accounts={accounts}
        accountsLoading={accountsLoading}
        files={files}
        filesLoading={filesLoading}
        creating={creating}
        onCreate={createTask}
      />

      {planLoaded && canUpgrade ? (
        <UpgradePlanModal
          open={upgradeOpen}
          onClose={() => setUpgradeOpen(false)}
          currentPlanId={planId}
        />
      ) : null}
    </>
  );
}
