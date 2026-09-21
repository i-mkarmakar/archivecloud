import { ArrowRotateRight, Link, Speedometer } from "@gravity-ui/icons";
import { Button, Card, Switch, toast } from "@heroui/react";
import { useEffect, useState } from "react";
import { GoogleDriveLogo } from "@/components/drive/GoogleDriveLogo";
import { PageHeader } from "@/components/drive/PageHeader";
import {
  AccountCardsSkeleton,
  StatCardsSkeleton,
} from "@/components/drive/PageSkeletons";
import { apiFetch, formatBytes } from "@/lib/api";
import { connectOAuthPopup } from "@/lib/oauth-connect";
import { cn } from "@/lib/utils";

type StorageSummary = {
  totalBytes: string;
  usedBytes: string;
  availableBytes: string;
};
type ConnectedAccount = {
  id: string;
  email: string;
  displayName?: string | null;
  provider: string;
  status: string;
  storageAccount?: {
    totalBytes: string | null;
    usedBytes: string;
    availableBytes: string | null;
    lastSyncedAt: string | null;
  } | null;
};
type RoutingMode = "most_available" | "round_robin" | "priority";
type RoutingPolicy = {
  mode: RoutingMode;
  priorityAccountIds: string[];
  roundRobinCursor: number;
};

function ProviderIcon({ className }: { className?: string }) {
  return <GoogleDriveLogo className={className ?? "h-6 w-6"} />;
}

function storageLimitLabel(account: ConnectedAccount) {
  return formatBytes(account.storageAccount?.totalBytes);
}

function availableLabel(account: ConnectedAccount) {
  return formatBytes(account.storageAccount?.availableBytes);
}

function pct(account: ConnectedAccount) {
  const total = Number(account.storageAccount?.totalBytes ?? 0);
  const used = Number(account.storageAccount?.usedBytes ?? 0);
  return total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
}

function statusColor(percent: number) {
  if (percent >= 80) return "bg-danger-soft text-danger-soft-foreground";
  if (percent >= 50) return "bg-warning-soft text-warning-soft-foreground";
  return "bg-success-soft text-success-soft-foreground";
}

type StatBadgeVariant = "success" | "warning" | "danger" | "neutral";

function statBadgeVariant(percent: number): StatBadgeVariant {
  if (percent >= 80) return "danger";
  if (percent >= 50) return "warning";
  return "success";
}

function StatBadge({
  value,
  trend,
  variant = "neutral",
}: {
  value: string;
  trend?: "up" | "down";
  variant?: StatBadgeVariant;
}) {
  const variantClass = {
    success: "bg-success-soft text-success-soft-foreground",
    warning: "bg-warning-soft text-warning-soft-foreground",
    danger: "bg-danger-soft text-danger-soft-foreground",
    neutral: "bg-surface-secondary text-muted",
  }[variant];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold",
        variantClass,
      )}
    >
      {trend === "up" ? "↑" : trend === "down" ? "↓" : null}
      {value}
    </span>
  );
}

function usagePercent(summary: StorageSummary | null) {
  const total = Number(summary?.totalBytes ?? 0);
  const used = Number(summary?.usedBytes ?? 0);
  return total > 0 ? Math.round((used / total) * 100) : 0;
}

function availablePercent(summary: StorageSummary | null) {
  const total = Number(summary?.totalBytes ?? 0);
  const available = Number(summary?.availableBytes ?? 0);
  return total > 0 ? Math.round((available / total) * 100) : 0;
}

export function QuotaTrackerPage() {
  const [summary, setSummary] = useState<StorageSummary | null>(null);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [routingPolicy, setRoutingPolicy] = useState<RoutingPolicy>({
    mode: "most_available",
    priorityAccountIds: [],
    roundRobinCursor: 0,
  });
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const [summaryData, accountData, policyData] = await Promise.all([
      apiFetch<StorageSummary>("/storage/summary"),
      apiFetch<{ accounts: ConnectedAccount[] }>("/connected-accounts"),
      apiFetch<{ policy: RoutingPolicy }>("/storage/routing-policy"),
    ]);
    setSummary(summaryData);
    setAccounts(accountData.accounts);
    setRoutingPolicy(policyData.policy);
  }

  async function refresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    load()
      .catch((error) =>
        toast.danger(
          error instanceof Error
            ? error.message
            : "Failed to load quota tracker",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(
      () => load().catch(() => undefined),
      35_000,
    );
    return () => window.clearInterval(timer);
  }, [autoRefresh]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (
        event.origin !== window.location.origin ||
        event.data?.type !== "GOOGLE_CONNECTED"
      )
        return;
      if (event.data.status === "success") {
        toast.success("Google Drive connected.");
      } else {
        toast.danger("Google Drive connection failed.");
      }
      load().catch(() => undefined);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  async function connectDrive() {
    try {
      await connectOAuthPopup({
        connectUrlPath: "/connected-accounts/google/connect",
        popupName: "google-drive-connect",
      });
    } catch (e) {
      console.error(
        "Failed to start Google Drive connection from Quota Tracker",
        e,
      );
    }
  }

  async function sync(accountId: string) {
    setSyncingAccountId(accountId);
    try {
      await apiFetch(`/connected-accounts/${accountId}/sync-quota`, {
        method: "POST",
      });
      await load();
    } finally {
      setSyncingAccountId(null);
    }
  }

  async function saveRoutingPolicy(nextPolicy: RoutingPolicy) {
    setRoutingPolicy(nextPolicy);
    const data = await apiFetch<{ policy: RoutingPolicy }>(
      "/storage/routing-policy",
      {
        method: "PATCH",
        body: JSON.stringify({
          mode: nextPolicy.mode,
          priorityAccountIds: nextPolicy.priorityAccountIds,
        }),
      },
    );
    setRoutingPolicy(data.policy);
    toast.success("Upload routing policy updated.");
  }

  function orderedAccounts() {
    const byId = new Map(accounts.map((account) => [account.id, account]));
    const ordered = routingPolicy.priorityAccountIds
      .map((id) => byId.get(id))
      .filter((account): account is ConnectedAccount => Boolean(account));
    const orderedIds = new Set(ordered.map((account) => account.id));
    return [
      ...ordered,
      ...accounts.filter((account) => !orderedIds.has(account.id)),
    ];
  }

  function moveAccount(accountId: string, direction: -1 | 1) {
    const ids = orderedAccounts().map((account) => account.id);
    const index = ids.indexOf(accountId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    const nextIds = [...ids];
    const [item] = nextIds.splice(index, 1);
    nextIds.splice(target, 0, item);
    saveRoutingPolicy({ ...routingPolicy, priorityAccountIds: nextIds }).catch(
      (error) =>
        toast.danger(
          error instanceof Error
            ? error.message
            : "Failed to update routing policy",
        ),
    );
  }

  const usedPct = usagePercent(summary);
  const availPct = availablePercent(summary);
  const connectedCount = accounts.filter(
    (account) => account.status === "connected",
  ).length;

  return (
    <>
      <PageHeader
        title="Quota Tracker"
        description="Track and manage connected Google Drive storage limits."
        actions={
          <>
            <Switch
              isSelected={autoRefresh}
              onChange={setAutoRefresh}
              size="md"
              aria-label="Auto-refresh"
            >
              <Switch.Content className="flex-row items-center gap-2">
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                <span className="whitespace-nowrap text-sm font-semibold">
                  Auto-refresh {autoRefresh ? "On" : "Off"}
                </span>
              </Switch.Content>
            </Switch>
            <Button variant="outline" onClick={refresh} isDisabled={refreshing}>
              <ArrowRotateRight
                className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"}
              />
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
            <Button onClick={connectDrive}>
              <Link className="h-4 w-4" />
              Connect Drive
            </Button>
          </>
        }
      />

      {loading ? (
        <>
          <StatCardsSkeleton className="mt-8" count={4} label="Loading quota" />
          <AccountCardsSkeleton
            className="mt-8"
            count={3}
            label="Loading accounts"
          />
        </>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            <Card className="p-5">
              <p className="text-sm text-muted">Total Storage</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-2xl font-extrabold">
                  {formatBytes(summary?.totalBytes)}
                </p>
                {accounts.length > 0 ? (
                  <StatBadge
                    value={`${accounts.length} drive${accounts.length === 1 ? "" : "s"}`}
                    variant="neutral"
                  />
                ) : null}
              </div>
            </Card>
            <Card className="p-5">
              <p className="text-sm text-muted">Used Storage</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-2xl font-extrabold">
                  {formatBytes(summary?.usedBytes)}
                </p>
                {summary ? (
                  <StatBadge
                    value={`${usedPct}%`}
                    trend="up"
                    variant={statBadgeVariant(usedPct)}
                  />
                ) : null}
              </div>
            </Card>
            <Card className="p-5">
              <p className="text-sm text-muted">Available</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-2xl font-extrabold">
                  {formatBytes(summary?.availableBytes)}
                </p>
                {summary ? (
                  <StatBadge
                    value={`${availPct}%`}
                    trend="up"
                    variant="success"
                  />
                ) : null}
              </div>
            </Card>
            <Card className="p-5">
              <p className="text-sm text-muted">Accounts</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-2xl font-extrabold">{accounts.length}</p>
                {accounts.length > 0 ? (
                  <StatBadge
                    value={`${connectedCount} connected`}
                    variant={
                      connectedCount === accounts.length ? "success" : "warning"
                    }
                  />
                ) : null}
              </div>
            </Card>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button variant="outline">All Accounts</Button>
            <Button variant="secondary">
              <Speedometer className="h-4 w-4" />
              Most available
            </Button>
          </div>

          <section className="mt-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-extrabold">Upload Routing</h2>
                <p className="mt-1 text-sm text-muted">
                  Choose how new uploads pick connected storage accounts.
                </p>
              </div>
              <label className="grid gap-2 text-sm font-semibold lg:w-64">
                Routing mode
                <select
                  className="h-11 rounded-xl border border-border bg-surface px-3 text-sm"
                  value={routingPolicy.mode}
                  onChange={(event) =>
                    saveRoutingPolicy({
                      ...routingPolicy,
                      mode: event.target.value as RoutingMode,
                    }).catch((error) =>
                      toast.danger(
                        error instanceof Error
                          ? error.message
                          : "Failed to update routing policy",
                      ),
                    )
                  }
                >
                  <option value="most_available">Most available</option>
                  <option value="round_robin">Round robin</option>
                  <option value="priority">Priority order</option>
                </select>
              </label>
            </div>
            <div className="mt-4 grid gap-3">
              {orderedAccounts().map((account, index) => (
                <div
                  key={account.id}
                  className="flex flex-col gap-3 rounded-xl p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-foreground">
                      <ProviderIcon />
                    </div>
                    <div>
                      <p className="font-semibold">
                        {account.displayName || account.email}
                      </p>
                      <p className="text-sm text-muted">
                        Google Drive ·{" "}
                        {formatBytes(account.storageAccount?.usedBytes)} used ·{" "}
                        {availableLabel(account)} free
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => moveAccount(account.id, -1)}
                      isDisabled={index === 0}
                    >
                      Up
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => moveAccount(account.id, 1)}
                      isDisabled={index === accounts.length - 1}
                    >
                      Down
                    </Button>
                  </div>
                </div>
              ))}
              {accounts.length === 0 ? (
                <p className="text-sm text-muted">
                  Connect storage accounts to configure routing.
                </p>
              ) : null}
            </div>
          </section>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {accounts.length === 0 ? (
              <div className="col-span-full flex min-h-[200px] items-center justify-center py-8">
                <div className="text-center">
                  <h2 className="text-xl font-extrabold">
                    No connected drives
                  </h2>
                  <p className="mt-2 text-sm text-muted">
                    Connect Google Drive to start tracking quota.
                  </p>
                  <Button className="mt-5" onClick={connectDrive}>
                    <Link className="h-4 w-4" />
                    Connect Drive
                  </Button>
                </div>
              </div>
            ) : (
              accounts.map((account) => {
                const percent = pct(account);
                const color = statusColor(percent);
                return (
                  <section key={account.id} className="overflow-hidden p-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                          <ProviderIcon />
                        </div>
                        <div>
                          <h2 className="font-extrabold">Google Drive</h2>
                          <p className="text-sm text-muted">{account.email}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          isIconOnly
                          size="sm"
                          onClick={() => sync(account.id)}
                          isDisabled={syncingAccountId === account.id}
                        >
                          <ArrowRotateRight
                            className={
                              syncingAccountId === account.id
                                ? "h-5 w-5 animate-spin"
                                : "h-5 w-5"
                            }
                          />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-6">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 font-semibold">
                          <span
                            className={cn(
                              "h-3 w-3 rounded-full",
                              color.split(" ")[0],
                            )}
                          />
                          storage
                        </span>
                        <span className="font-bold">{percent}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-surface-secondary">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            color.split(" ")[0],
                          )}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-sm text-muted">
                        <span>
                          {formatBytes(account.storageAccount?.usedBytes)} /{" "}
                          {storageLimitLabel(account)}
                        </span>
                        <span>Available {availableLabel(account)}</span>
                      </div>
                    </div>
                  </section>
                );
              })
            )}
          </div>
        </>
      )}
    </>
  );
}
