"use client";

import {
  ArrowRotateRight,
  CircleCheck,
  CircleExclamation,
  Clock,
  FolderArrowRight,
  Plus,
  Thunderbolt,
} from "@gravity-ui/icons";
import { Button, Card, Input, Skeleton, toast } from "@heroui/react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/drive/PageHeader";
import { AutoSyncRestrictedModal } from "@/components/drive/AutoSyncRestrictedModal";
import { UpgradePlanModal } from "@/components/drive/UpgradePlanModal";
import { apiFetch } from "@/lib/api";
import { useUserPlan } from "@/hooks/useUserPlan";
import { isSupportedProviderId, providerLabel } from "@/lib/providers";
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
          "absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full",
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

function AutoSyncPageSkeleton() {
  return (
    <div
      className="skeleton--shimmer relative mt-5 overflow-hidden"
      role="status"
      aria-busy="true"
      aria-label="Loading Auto-Sync"
    >
      <Skeleton animationType="none" className="h-[58px] w-full rounded-xl" />

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {["stat-a", "stat-b", "stat-c"].map((id) => (
          <Card
            key={id}
            className="relative overflow-hidden border border-border bg-white p-5 shadow-none"
          >
            <Skeleton
              animationType="none"
              className="absolute right-4 top-4 h-9 w-9 rounded-full"
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

function FolderSyncListSkeleton() {
  return (
    <div
      className="skeleton--shimmer relative mt-4 grid gap-3 overflow-hidden"
      role="status"
      aria-busy="true"
      aria-label="Loading folder syncs"
    >
      {["row-a", "row-b", "row-c"].map((id) => (
        <div
          key={id}
          className="rounded-2xl border border-border bg-surface-secondary p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton
                animationType="none"
                className="h-4 w-48 max-w-full rounded"
              />
              <Skeleton
                animationType="none"
                className="h-3 w-36 max-w-full rounded"
              />
              <Skeleton
                animationType="none"
                className="h-3 w-28 max-w-full rounded"
              />
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <Skeleton animationType="none" className="h-8 w-20 rounded-lg" />
              <Skeleton animationType="none" className="h-8 w-20 rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function FolderSyncView() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);

  const [folderSyncs, setFolderSyncs] = useState<FolderSyncItem[]>([]);
  const [folderSyncsLoading, setFolderSyncsLoading] = useState(true);
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [sourceParentId, setSourceParentId] = useState("root");
  const [folderDestAccountId, setFolderDestAccountId] = useState("");
  const [destParentId, setDestParentId] = useState("root");
  const [folderScheduleKind, setFolderScheduleKind] = useState<
    "manual" | "daily" | "weekly"
  >("manual");
  const [folderDirection, setFolderDirection] = useState<"one_way" | "two_way">(
    "one_way",
  );
  const [folderPollEnabled, setFolderPollEnabled] = useState(false);
  const [tickBusy, setTickBusy] = useState(false);

  const { planId, hasFeature, canUpgrade, loaded: planLoaded } = useUserPlan();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [restrictedOpen, setRestrictedOpen] = useState(false);
  const hasFolderSync = hasFeature("folderSync");

  useEffect(() => {
    if (planLoaded && !hasFolderSync) {
      setRestrictedOpen(true);
    }
  }, [planLoaded, hasFolderSync]);

  function requestUpgradeOrCreate() {
    if (!hasFolderSync) {
      setRestrictedOpen(true);
      return;
    }
    document.getElementById("create-folder-sync")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
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
      setSourceAccountId((prev) => prev || supported[0]?.id || "");
      setFolderDestAccountId(
        (prev) => prev || supported[1]?.id || supported[0]?.id || "",
      );
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

  async function createFolderSync() {
    if (!hasFolderSync) {
      if (canUpgrade) setUpgradeOpen(true);
      return;
    }
    if (!sourceAccountId) {
      toast.danger("Choose a source account.");
      return;
    }
    if (!folderDestAccountId) {
      toast.danger("Choose a destination account.");
      return;
    }

    try {
      await apiFetch("/sync/folder", {
        method: "POST",
        body: JSON.stringify({
          sourceAccountId,
          destAccountId: folderDestAccountId,
          sourceParentId: sourceParentId.trim() || "root",
          destParentId: destParentId.trim() || "root",
          scheduleKind: folderScheduleKind,
          direction: folderDirection,
          pollEnabled: folderPollEnabled,
        }),
      });
      toast.success(
        folderDirection === "two_way"
          ? "Two-way folder sync created."
          : "Folder sync created.",
      );
      await loadFolderSyncs();
    } catch (err) {
      toast.danger(
        err instanceof Error ? err.message : "Failed to create folder sync",
      );
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
              onPress={requestUpgradeOrCreate}
            >
              <Plus className="h-3.5 w-3.5" />
              New sync pair
            </Button>
          </div>
        }
      />

      {!planLoaded ? (
        <AutoSyncPageSkeleton />
      ) : !hasFolderSync ? (
        <>
          <div
            role="alert"
            className="mt-5 flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500 text-white">
              <CircleExclamation className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-red-600">
                Auto-Sync Creation Restricted
              </p>
              <p className="mt-0.5 text-sm text-[#374151]">
                Auto-Sync requires an active subscription or Thunder plan.
              </p>
            </div>
          </div>

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
                Create your first instant folder sync pair to keep your cloud
                files seamlessly mirrored in real-time across providers.
              </p>
            </div>
          </Card>
        </>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-[360px_1fr]">
          <Card id="create-folder-sync" className="scroll-mt-4 p-5">
            <div className="flex items-center gap-2">
              <FolderArrowRight className="h-5 w-5 text-muted" />
              <p className="font-extrabold">Create folder sync</p>
            </div>

            <div className="mt-4 grid gap-3">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                  Source account
                </p>
                <select
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
                  value={sourceAccountId}
                  disabled={accountsLoading || accounts.length === 0}
                  onChange={(e) => setSourceAccountId(e.target.value)}
                >
                  {accounts.length === 0 ? (
                    <option value="">No accounts</option>
                  ) : null}
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {providerLabel(a.provider)} · {a.displayName || a.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                  Source folder id
                </p>
                <Input
                  value={sourceParentId}
                  onChange={(e) => setSourceParentId(e.target.value)}
                  placeholder="root"
                />
              </div>

              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                  Destination account
                </p>
                <select
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
                  value={folderDestAccountId}
                  disabled={accountsLoading || accounts.length === 0}
                  onChange={(e) => setFolderDestAccountId(e.target.value)}
                >
                  {accounts.length === 0 ? (
                    <option value="">No accounts</option>
                  ) : null}
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {providerLabel(a.provider)} · {a.displayName || a.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                  Destination folder id
                </p>
                <Input
                  value={destParentId}
                  onChange={(e) => setDestParentId(e.target.value)}
                  placeholder="root"
                />
              </div>

              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                  Direction
                </p>
                <select
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
                  value={folderDirection}
                  onChange={(e) =>
                    setFolderDirection(e.target.value as typeof folderDirection)
                  }
                >
                  <option value="one_way">
                    One-way (source → destination)
                  </option>
                  <option value="two_way">Two-way (keep both in sync)</option>
                </select>
              </div>

              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                  Schedule
                </p>
                <select
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
                  value={folderScheduleKind}
                  onChange={(e) =>
                    setFolderScheduleKind(
                      e.target.value as typeof folderScheduleKind,
                    )
                  }
                >
                  {(["manual", "daily", "weekly"] as const).map((k) => (
                    <option key={k} value={k}>
                      {humanScheduleKind(k)}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={folderPollEnabled}
                  onChange={(e) => setFolderPollEnabled(e.target.checked)}
                />
                <span>
                  Auto-poll for changes (every ~5 min while page open / tick)
                </span>
              </label>

              <Button
                onPress={() => createFolderSync().catch(() => undefined)}
                isDisabled={!sourceAccountId || !folderDestAccountId}
              >
                Create folder sync
              </Button>
            </div>

            <p className="mt-4 text-xs text-muted">
              Recursive sync: mirrors nested folders and copies missing files by
              name. Two-way runs both directions on each run.
            </p>
          </Card>

          <Card className="p-5">
            <p className="font-extrabold">Folder syncs</p>

            {folderSyncsLoading ? <FolderSyncListSkeleton /> : null}

            {!folderSyncsLoading && folderSyncs.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No folder syncs yet.</p>
            ) : null}

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
                          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-soft-foreground">
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
                        <span className="text-xs font-bold uppercase text-muted">
                          {s.status}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

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
