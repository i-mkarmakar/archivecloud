"use client";

import {
  ArrowRotateRight,
  CircleCheck,
  Clock,
  Plus,
  Thunderbolt,
} from "@gravity-ui/icons";
import { Button, Card, Skeleton, toast } from "@heroui/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  NewSyncPairModal,
  type CreateSyncPairPayload,
} from "@/components/automation/NewSyncPairModal";
import { PageHeader } from "@/components/drive/PageHeader";
import { AutoSyncRestrictedModal } from "@/components/drive/AutoSyncRestrictedModal";
import { UpgradePlanModal } from "@/components/drive/UpgradePlanModal";
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

type FolderSyncItem = {
  id: string;
  status: string;
  direction: string;
  sourceAccountId: string;
  destAccountId: string;
  sourceParentId: string;
  destParentId: string;
  sourceLabel: string | null;
  destLabel: string | null;
  scheduleKind: string;
  pollEnabled: boolean;
  lastPolledAt: string | null;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastError: string | null;
  sourceAccountEmail: string | null;
  destAccountEmail: string | null;
};

function humanScheduleKind(kind: string) {
  if (kind === "manual") return "Manual";
  if (kind === "daily") return "Daily";
  if (kind === "weekly") return "Weekly";
  if (kind === "auto") return "Auto";
  return kind;
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
          "absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full",
          iconClassName,
        )}
      >
        {icon}
      </div>
      <p className="pr-12 text-[11px] font-bold tracking-wide text-muted uppercase">
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

function AutoSyncPageSkeleton() {
  return (
    <div
      className="skeleton--shimmer relative mt-5 overflow-hidden"
      role="status"
      aria-busy="true"
      aria-label="Loading Auto-Sync"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {["stat-a", "stat-b", "stat-c"].map((id) => (
          <Card
            key={id}
            className="relative overflow-hidden border border-border bg-white p-5 shadow-none"
          >
            <Skeleton
              animationType="none"
              className="absolute top-4 right-4 h-9 w-9 rounded-full"
            />
            <Skeleton animationType="none" className="h-3 w-24 rounded" />
            <Skeleton
              animationType="none"
              className="mt-3 h-8 w-16 rounded-lg"
            />
            <Skeleton
              animationType="none"
              className="mt-2 h-3 w-4/5 max-w-[200px] rounded"
            />
          </Card>
        ))}
      </div>

      <Card className="mt-5 flex min-h-[280px] items-center justify-center border border-border bg-white p-10 shadow-none sm:min-h-[340px]">
        <div className="flex w-full max-w-md flex-col items-center gap-3">
          <Skeleton animationType="none" className="h-10 w-10 rounded-lg" />
          <Skeleton animationType="none" className="h-5 w-56 rounded-lg" />
          <Skeleton animationType="none" className="h-3 w-full rounded" />
          <Skeleton animationType="none" className="h-3 w-4/5 rounded" />
        </div>
      </Card>
    </div>
  );
}

function AutoSyncEmptyState() {
  return (
    <>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Active Pairs"
          value="0"
          hint="0 of 0 pairs syncing right now"
          icon={<Thunderbolt className="h-4 w-4" />}
          iconClassName="bg-primary/10 text-primary"
        />
        <StatCard
          label="Sync Status"
          value="No Pairs Yet"
          hint="Create a sync pair to start mirroring files automatically."
          valueClassName="text-xl sm:text-2xl"
          icon={<CircleCheck className="h-4 w-4" />}
          iconClassName="bg-[#f3f4f6] text-[#6b7280]"
        />
        <StatCard
          label="Last Activity"
          value="No activity yet"
          hint="Most recent file synced across all your pairs."
          valueClassName="text-xl sm:text-2xl"
          icon={<Clock className="h-4 w-4" />}
          iconClassName="bg-[#e8faf0] text-[#16a34a]"
        />
      </div>

      <Card className="mt-5 flex min-h-[280px] items-center justify-center border border-border bg-white p-10 shadow-none sm:min-h-[340px]">
        <div className="mx-auto max-w-md text-center">
          <Thunderbolt className="mx-auto h-10 w-10 text-primary" />
          <p className="mt-4 text-lg font-extrabold text-foreground">
            No Active Auto-Sync Pairs
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Create your first instant folder sync pair to keep your cloud files
            seamlessly mirrored in real-time across providers.
          </p>
        </div>
      </Card>
    </>
  );
}

export function FolderSyncView() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [folderSyncs, setFolderSyncs] = useState<FolderSyncItem[]>([]);
  const [folderSyncsLoading, setFolderSyncsLoading] = useState(true);
  const [tickBusy, setTickBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const { planId, hasFeature, canUpgrade, loaded: planLoaded } = useUserPlan();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [restrictedOpen, setRestrictedOpen] = useState(false);
  const hasFolderSync = hasFeature("folderSync");

  function requestNewSyncPair() {
    if (!hasFolderSync) {
      setRestrictedOpen(true);
      return;
    }
    setCreateOpen(true);
  }

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
    } catch (err) {
      toast.danger(
        err instanceof Error
          ? err.message
          : "Failed to load connected accounts",
      );
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  const loadFolderSyncs = useCallback(async () => {
    setFolderSyncsLoading(true);
    try {
      const data = await apiFetch<{ syncs: FolderSyncItem[] }>("/sync/folder");
      setFolderSyncs(data.syncs);
    } catch (err) {
      toast.danger(
        err instanceof Error ? err.message : "Failed to load folder syncs",
      );
    } finally {
      setFolderSyncsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts().catch(() => undefined);
    loadFolderSyncs().catch(() => undefined);
    apiFetch("/sync/tick", { method: "POST" }).catch(() => undefined);
  }, [loadAccounts, loadFolderSyncs]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      apiFetch("/sync/tick", { method: "POST" }).catch(() => undefined);
    }, 20_000);
    return () => window.clearInterval(timer);
  }, []);

  async function tickNow() {
    setTickBusy(true);
    try {
      await apiFetch("/sync/tick", { method: "POST" });
      toast.success("Due folder sync runs started.");
      await loadFolderSyncs();
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : "Tick failed");
    } finally {
      setTickBusy(false);
    }
  }

  async function createFolderSync(payload: CreateSyncPairPayload) {
    setCreating(true);
    try {
      await apiFetch("/sync/folder", {
        method: "POST",
        body: JSON.stringify({
          sourceAccountId: payload.sourceAccountId,
          destAccountId: payload.destAccountId,
          sourceParentId: payload.sourceParentId,
          destParentId: payload.destParentId,
          scheduleKind: "auto",
          direction: payload.direction,
          pollEnabled: true,
          sourceLabel: payload.sourceLabel,
        }),
      });
      toast.success(
        payload.direction === "two_way"
          ? "Two-way folder sync created."
          : "Folder sync created.",
      );
      setCreateOpen(false);
      await loadFolderSyncs();
    } catch (err) {
      toast.danger(
        err instanceof Error ? err.message : "Failed to create folder sync",
      );
    } finally {
      setCreating(false);
    }
  }

  async function runFolderSyncNow(syncId: string) {
    try {
      const result = await apiFetch<{ queuedJobs: number }>(
        `/sync/folder/${syncId}/run`,
        { method: "POST" },
      );
      toast.success(
        result.queuedJobs > 0
          ? `Queued ${result.queuedJobs} file cop${result.queuedJobs === 1 ? "y" : "ies"}.`
          : "No new files to copy.",
      );
      await loadFolderSyncs();
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : "Run failed");
    }
  }

  const stats = useMemo(() => {
    const active = folderSyncs.filter((s) => s.status === "active").length;
    const total = folderSyncs.length;
    const lastRun = folderSyncs
      .map((s) => s.lastRunAt)
      .filter(Boolean)
      .sort()
      .at(-1);
    return {
      active,
      total,
      statusLabel:
        total === 0 ? "No Pairs Yet" : active > 0 ? "Active" : "Paused",
      statusHint:
        total === 0
          ? "Create a sync pair to start mirroring files automatically."
          : `${active} of ${total} pairs syncing right now.`,
      lastActivity: lastRun
        ? new Date(lastRun).toLocaleString()
        : "No activity yet",
    };
  }, [folderSyncs]);

  const showEmpty =
    planLoaded && !folderSyncsLoading && folderSyncs.length === 0;

  return (
    <>
      <PageHeader
        title="Auto-Sync"
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-[11px]"
              isDisabled={tickBusy || !hasFolderSync}
              onPress={() => tickNow().catch(() => undefined)}
            >
              <ArrowRotateRight className="h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button
              size="sm"
              variant="primary"
              className="h-8 px-3 text-[11px]"
              onPress={requestNewSyncPair}
            >
              <Plus className="h-3.5 w-3.5" />
              New sync pair
            </Button>
          </div>
        }
      />

      {!planLoaded || folderSyncsLoading ? (
        <AutoSyncPageSkeleton />
      ) : showEmpty ? (
        <AutoSyncEmptyState />
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Active Pairs"
              value={String(stats.active)}
              hint={`${stats.active} of ${stats.total} pairs syncing right now`}
              icon={<Thunderbolt className="h-4 w-4" />}
              iconClassName="bg-primary/10 text-primary"
            />
            <StatCard
              label="Sync Status"
              value={stats.statusLabel}
              hint={stats.statusHint}
              valueClassName="text-xl sm:text-2xl"
              icon={<CircleCheck className="h-4 w-4" />}
              iconClassName="bg-[#f3f4f6] text-[#6b7280]"
            />
            <StatCard
              label="Last Activity"
              value={stats.lastActivity}
              hint="Most recent file synced across all your pairs."
              valueClassName="text-xl sm:text-2xl"
              icon={<Clock className="h-4 w-4" />}
              iconClassName="bg-[#e8faf0] text-[#16a34a]"
            />
          </div>

          <Card className="mt-5 p-5">
            <p className="font-extrabold">Folder syncs</p>
            <div className="mt-4 grid gap-3">
              {folderSyncs.map((s) => (
                <div
                  key={s.id}
                  className="rounded-2xl border border-border bg-surface-secondary p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-extrabold">
                        {s.sourceLabel ??
                          (s.direction === "two_way"
                            ? `${s.sourceAccountEmail ?? "A"} ↔ ${s.destAccountEmail ?? "B"}`
                            : `${s.sourceAccountEmail ?? "Source"} → ${s.destAccountEmail ?? "Dest"}`)}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                        <span>
                          {s.direction === "two_way" ? "Two-way" : "One-way"} ·{" "}
                          {humanScheduleKind(s.scheduleKind)}
                          {s.nextRunAt
                            ? ` · Next: ${new Date(s.nextRunAt).toLocaleString()}`
                            : ""}
                        </span>
                        {s.pollEnabled ? (
                          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold tracking-wide text-accent-soft-foreground uppercase">
                            Polling
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {s.sourceParentId} → {s.destParentId}
                      </p>
                      {s.lastRunAt ? (
                        <p className="mt-1 text-xs text-muted">
                          Last run: {new Date(s.lastRunAt).toLocaleString()}
                        </p>
                      ) : null}
                      {s.lastError ? (
                        <p className="mt-2 text-sm text-danger-soft-foreground">
                          {s.lastError}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted">
                        {s.sourceAccountEmail ?? "Source"} →{" "}
                        {s.destAccountEmail ?? "Destination"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      {s.status !== "deleted" ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onPress={() =>
                              runFolderSyncNow(s.id).catch(() => undefined)
                            }
                          >
                            Run now
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onPress={() => {
                              apiFetch(`/sync/folder/${s.id}`, {
                                method: "PATCH",
                                body: JSON.stringify({
                                  pollEnabled: !s.pollEnabled,
                                }),
                              })
                                .then(() => {
                                  toast.success(
                                    s.pollEnabled
                                      ? "Auto-poll disabled."
                                      : "Auto-poll enabled.",
                                  );
                                  loadFolderSyncs().catch(() => undefined);
                                })
                                .catch((err) =>
                                  toast.danger(
                                    err instanceof Error
                                      ? err.message
                                      : "Poll toggle failed",
                                  ),
                                );
                            }}
                          >
                            {s.pollEnabled ? "Disable poll" : "Enable poll"}
                          </Button>
                          {s.status === "active" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onPress={() => {
                                apiFetch(`/sync/folder/${s.id}`, {
                                  method: "PATCH",
                                  body: JSON.stringify({ status: "paused" }),
                                })
                                  .then(() => {
                                    toast.success("Folder sync paused.");
                                    loadFolderSyncs().catch(() => undefined);
                                  })
                                  .catch((err) =>
                                    toast.danger(
                                      err instanceof Error
                                        ? err.message
                                        : "Pause failed",
                                    ),
                                  );
                              }}
                            >
                              Pause
                            </Button>
                          ) : s.status === "paused" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onPress={() => {
                                apiFetch(`/sync/folder/${s.id}`, {
                                  method: "PATCH",
                                  body: JSON.stringify({ status: "active" }),
                                })
                                  .then(() => {
                                    toast.success("Folder sync resumed.");
                                    loadFolderSyncs().catch(() => undefined);
                                  })
                                  .catch((err) =>
                                    toast.danger(
                                      err instanceof Error
                                        ? err.message
                                        : "Resume failed",
                                    ),
                                  );
                              }}
                            >
                              Resume
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="outline"
                            onPress={() => {
                              apiFetch(`/sync/folder/${s.id}`, {
                                method: "DELETE",
                              })
                                .then(() => {
                                  toast.success("Folder sync deleted.");
                                  loadFolderSyncs().catch(() => undefined);
                                })
                                .catch((err) =>
                                  toast.danger(
                                    err instanceof Error
                                      ? err.message
                                      : "Delete failed",
                                  ),
                                );
                            }}
                          >
                            Delete
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs font-bold text-muted uppercase">
                          {s.status}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      <NewSyncPairModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        accounts={accounts}
        accountsLoading={accountsLoading}
        creating={creating}
        onCreate={createFolderSync}
      />

      <AutoSyncRestrictedModal
        open={restrictedOpen}
        canUpgrade={canUpgrade}
        onClose={() => setRestrictedOpen(false)}
        onUpgrade={() => {
          setRestrictedOpen(false);
          setUpgradeOpen(true);
        }}
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
