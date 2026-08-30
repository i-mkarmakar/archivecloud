"use client";

import { useUser } from "@clerk/nextjs";
import { Button, Card, Input, toast } from "@heroui/react";
import {
  ArrowRotateRight,
  Bell,
  ClockArrowRotateLeft,
  Cloud,
  CurlyBrackets,
  Database,
  Globe,
  HardDrive,
  Link,
  TrashBin,
} from "@gravity-ui/icons";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { DummyModal } from "@/components/drive/DummyModal";
import { PageHeader } from "@/components/drive/PageHeader";
import { useDeveloperMode } from "@/context/DeveloperModeContext";
import { apiFetch, formatBytes, formatDate } from "@/lib/api";
import { clerkUserToAuthUser } from "@/lib/auth";
import { getGravatarUrl } from "@/lib/gravatar";

type ConnectedAccount = {
  id: string;
  provider: string;
  email: string;
  displayName?: string | null;
  status: string;
  storageAccount?: {
    totalBytes: string | null;
    usedBytes: string;
    availableBytes: string | null;
    lastSyncedAt: string | null;
  } | null;
};

type AuditLog = {
  id: string;
  action: string;
  createdAt: string;
};

function providerLabel(provider: string) {
  if (provider === "s3") return "S3 Storage";
  return "Google Drive";
}

function storageLimitLabel(account: ConnectedAccount) {
  if (account.provider === "s3" && account.storageAccount?.totalBytes === null)
    return "Unlimited";
  return formatBytes(account.storageAccount?.totalBytes);
}

function availableLabel(account: ConnectedAccount) {
  if (
    account.provider === "s3" &&
    account.storageAccount?.availableBytes === null
  )
    return "Unlimited";
  return formatBytes(account.storageAccount?.availableBytes);
}

export function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: clerkUser } = useUser();
  const user = clerkUser ? clerkUserToAuthUser(clerkUser) : null;
  const {
    developerModeEnabled,
    enableDeveloperMode,
    loading: developerLoading,
  } = useDeveloperMode();

  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [enablingDeveloper, setEnablingDeveloper] = useState(false);
  const [s3Open, setS3Open] = useState(false);
  const [connectingS3, setConnectingS3] = useState(false);
  const [s3Form, setS3Form] = useState({
    name: "",
    bucket: "",
    region: "us-east-1",
    endpoint: "",
    accessKeyId: "",
    secretAccessKey: "",
    forcePathStyle: false,
    quotaBytes: "",
  });
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const [disconnectingAccountId, setDisconnectingAccountId] = useState<
    string | null
  >(null);
  const [accountToDisconnect, setAccountToDisconnect] =
    useState<ConnectedAccount | null>(null);
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [avatarError, setAvatarError] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState("");

  const selectedAccount =
    accounts.find((account) => account.id === selectedAccountId) ??
    accounts[0] ??
    null;

  async function load() {
    const [accountsData, logsData] = await Promise.all([
      apiFetch<{ accounts: ConnectedAccount[] }>("/connected-accounts"),
      apiFetch<{ logs: AuditLog[] }>("/audit-logs?limit=8"),
    ]);
    setAccounts(accountsData.accounts);
    setRecentLogs(logsData.logs);
  }

  useEffect(() => {
    load().catch((error) =>
      toast.danger(
        error instanceof Error ? error.message : "Failed to load settings",
      ),
    );
  }, []);

  useEffect(() => {
    if (searchParams.get("developer") === "required") {
      toast.info("Enable Developer Console below to access developer tools.");
    }
  }, [searchParams]);

  useEffect(() => {
    setAvatarError(false);
    getGravatarUrl(user?.email, 96)
      .then(setProfileImageUrl)
      .catch(() => setProfileImageUrl(""));
  }, [user?.email]);

  useEffect(() => {
    if (accounts.length === 0) {
      setSelectedAccountId("");
      return;
    }
    if (!accounts.some((account) => account.id === selectedAccountId)) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (
        event.origin !== window.location.origin ||
        event.data?.type !== "GOOGLE_CONNECTED"
      ) {
        return;
      }
      if (event.data.status === "success") {
        toast.success("Google Drive connected.");
      } else {
        toast.danger("Google Drive connection failed.");
      }
      load()
        .then(() => {
          window.dispatchEvent(new Event("archivecloud:storage-changed"));
        })
        .catch(() => undefined);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  async function connectDrive() {
    setConnecting(true);
    const popup = window.open(
      "",
      "google-drive-connect",
      "width=540,height=720",
    );
    if (popup) {
      popup.document.write(
        '<html><head><title>Connecting...</title><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8fafc;color:#64748b;}</style></head><body><div style="text-align:center;"><h2>Connecting to Google...</h2><p>Please wait while we redirect you.</p></div></body></html>',
      );
    }
    try {
      const data = await apiFetch<{ url: string }>(
        "/connected-accounts/google/connect-url",
      );
      if (popup) {
        popup.location.href = data.url;
      } else {
        window.location.href = data.url;
      }
    } catch (error) {
      if (popup) popup.close();
      toast.danger(
        error instanceof Error
          ? error.message
          : "Failed to start Google Drive connection",
      );
    } finally {
      setConnecting(false);
    }
  }

  async function sync(accountId: string) {
    setSyncingAccountId(accountId);
    try {
      await apiFetch(`/connected-accounts/${accountId}/sync-quota`, {
        method: "POST",
      });
      await load();
      window.dispatchEvent(new Event("archivecloud:storage-changed"));
    } finally {
      setSyncingAccountId(null);
    }
  }

  async function disconnect() {
    if (!accountToDisconnect) return;
    setDisconnectingAccountId(accountToDisconnect.id);
    try {
      await apiFetch(`/connected-accounts/${accountToDisconnect.id}`, {
        method: "DELETE",
      });
      setAccountToDisconnect(null);
      toast.success("Storage account disconnected.");
      await load();
      window.dispatchEvent(new Event("archivecloud:storage-changed"));
    } catch (error) {
      toast.danger(
        error instanceof Error
          ? error.message
          : "Failed to disconnect storage account",
      );
    } finally {
      setDisconnectingAccountId(null);
    }
  }

  async function connectS3(event: FormEvent) {
    event.preventDefault();
    setConnectingS3(true);
    try {
      await apiFetch("/connected-accounts/s3", {
        method: "POST",
        body: JSON.stringify({
          ...s3Form,
          endpoint: s3Form.endpoint || undefined,
          quotaBytes: s3Form.quotaBytes || null,
        }),
      });
      setS3Open(false);
      setS3Form({
        name: "",
        bucket: "",
        region: "us-east-1",
        endpoint: "",
        accessKeyId: "",
        secretAccessKey: "",
        forcePathStyle: false,
        quotaBytes: "",
      });
      toast.success("S3 storage connected.");
      await load();
      window.dispatchEvent(new Event("archivecloud:storage-changed"));
    } catch (error) {
      toast.danger(
        error instanceof Error ? error.message : "Failed to connect S3 storage",
      );
    } finally {
      setConnectingS3(false);
    }
  }

  async function handleEnableDeveloper() {
    setEnablingDeveloper(true);
    try {
      await enableDeveloperMode();
      toast.success("Developer Console enabled.");
      router.push("/developer");
    } catch (error) {
      toast.danger(
        error instanceof Error
          ? error.message
          : "Failed to enable Developer Console",
      );
    } finally {
      setEnablingDeveloper(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your account and connected storage."
        actions={
          <>
            <Button variant="outline" size="sm" onPress={() => setS3Open(true)}>
              <Database className="h-4 w-4" />
              Connect S3
            </Button>
            <Button size="sm" onPress={connectDrive} isDisabled={connecting}>
              <Link className="h-4 w-4" />
              {connecting ? "Connecting..." : "Connect Drive"}
            </Button>
          </>
        }
      />
      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="grid gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3.5">
              {!profileImageUrl || avatarError ? (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-lg font-bold text-accent-foreground shadow-sm border border-border sm:h-14 sm:w-14">
                  {(user?.name ?? user?.email ?? "U")
                    .trim()
                    .charAt(0)
                    .toUpperCase()}
                </div>
              ) : (
                <img
                  src={profileImageUrl}
                  alt="User avatar"
                  className="h-12 w-12 rounded-xl object-cover sm:h-14 sm:w-14"
                  onError={() => setAvatarError(true)}
                />
              )}
              <div className="flex-1">
                <h2 className="text-lg font-bold">{user?.name ?? "User"}</h2>
                <p className="text-xs text-muted mt-0.5">
                  {user?.email ?? "-"}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2.5">
                  <CurlyBrackets className="h-5 w-5 text-foreground" />
                  <h2 className="text-[16px] font-bold">Developer Console</h2>
                </div>
                <p className="mt-1 text-[13px] text-muted">
                  API keys, provider setup, audit logs, and instance operations.
                </p>
              </div>
              {developerModeEnabled ? (
                <Button
                  size="sm"
                  className="w-full sm:w-auto"
                  onPress={() => router.push("/developer")}
                >
                  Open Console
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="w-full sm:w-auto"
                  onPress={handleEnableDeveloper}
                  isDisabled={developerLoading || enablingDeveloper}
                >
                  {enablingDeveloper
                    ? "Enabling..."
                    : "Enable Developer Console"}
                </Button>
              )}
            </div>
          </Card>

          <Card className="overflow-hidden p-3.5">
            <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2.5">
                  <Cloud className="h-5 w-5 text-foreground" />
                  <h2 className="text-[16px] font-bold">Google Drive</h2>
                </div>
                <p className="mt-1 text-[13px] text-muted">
                  Connect Google Drive accounts to store and sync your files.
                </p>
              </div>
              <Button
                className="w-full sm:w-32"
                size="sm"
                onPress={connectDrive}
                isDisabled={connecting}
              >
                <Link className="h-4 w-4" />
                {connecting ? "Opening..." : "Connect Drive"}
              </Button>
            </div>
          </Card>

          <Card className="overflow-hidden p-3.5">
            <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2.5">
                  <Database className="h-5 w-5 text-foreground" />
                  <h2 className="text-[16px] font-bold">S3 Compatible</h2>
                </div>
                <p className="mt-1 text-[13px] text-muted">
                  Connect AWS S3, Cloudflare R2, MinIO, or other S3-compatible
                  storage.
                </p>
              </div>
              <Button
                className="w-full sm:w-32"
                size="sm"
                variant="outline"
                onPress={() => setS3Open(true)}
              >
                <Database className="h-4 w-4" />
                Connect S3
              </Button>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-[16px] font-bold">
              Connected Storage Accounts
            </h2>
            <div className="mt-3.5 grid gap-3">
              {accounts.length === 0 ? (
                <p className="text-xs text-muted">
                  No connected storage account yet.
                </p>
              ) : (
                <>
                  <label className="grid gap-1.5 text-xs font-semibold text-muted">
                    Choose Account
                    <select
                      className="h-10 rounded-xl border border-border bg-surface px-3 text-sm focus:outline-none"
                      value={selectedAccount?.id ?? ""}
                      onChange={(event) =>
                        setSelectedAccountId(event.target.value)
                      }
                    >
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {providerLabel(account.provider)} -{" "}
                          {account.displayName || account.email} (
                          {account.status})
                        </option>
                      ))}
                    </select>
                  </label>
                  {selectedAccount ? (
                    <div className="rounded-xl bg-background-secondary p-3 border border-separator">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="break-all font-semibold text-sm">
                            {selectedAccount.displayName ||
                              selectedAccount.email}
                          </p>
                          <p className="text-xs text-muted mt-0.5">
                            {providerLabel(selectedAccount.provider)} ·{" "}
                            {selectedAccount.status}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:flex">
                          <Button
                            className="w-full"
                            size="sm"
                            variant="outline"
                            onPress={() => sync(selectedAccount.id)}
                            isDisabled={syncingAccountId === selectedAccount.id}
                          >
                            <ArrowRotateRight
                              className={
                                syncingAccountId === selectedAccount.id
                                  ? "h-4 w-4 animate-spin"
                                  : "h-4 w-4"
                              }
                            />
                            {syncingAccountId === selectedAccount.id
                              ? "Syncing..."
                              : "Sync"}
                          </Button>
                          <Button
                            className="w-full"
                            size="sm"
                            variant="danger"
                            onPress={() =>
                              setAccountToDisconnect(selectedAccount)
                            }
                          >
                            <TrashBin className="h-4 w-4" />
                            Disconnect
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-xl bg-white dark:bg-surface p-2 border border-separator">
                          <p className="font-extrabold text-foreground">
                            {formatBytes(
                              selectedAccount.storageAccount?.usedBytes,
                            )}
                          </p>
                          <p className="mt-0.5 text-[10px] text-muted">Used</p>
                        </div>
                        <div className="rounded-xl bg-white dark:bg-surface p-2 border border-separator">
                          <p className="font-extrabold text-foreground">
                            {storageLimitLabel(selectedAccount)}
                          </p>
                          <p className="mt-0.5 text-[10px] text-muted">Total</p>
                        </div>
                        <div className="rounded-xl bg-white dark:bg-surface p-2 border border-separator">
                          <p className="font-extrabold text-foreground">
                            {availableLabel(selectedAccount)}
                          </p>
                          <p className="mt-0.5 text-[10px] text-muted">Free</p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ClockArrowRotateLeft className="h-5 w-5 text-foreground" />
                <h2 className="text-[16px] font-bold">Recent Activity</h2>
              </div>
              {developerModeEnabled ? (
                <button
                  type="button"
                  className="text-xs font-semibold text-foreground hover:underline"
                  onClick={() => router.push("/developer/activity")}
                >
                  View full log
                </button>
              ) : null}
            </div>
            <div className="mt-3 grid gap-2">
              {recentLogs.length === 0 ? (
                <p className="text-xs text-muted">No recent activity yet.</p>
              ) : (
                recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between rounded-xl bg-background-secondary px-3 py-2 text-xs"
                  >
                    <span className="font-semibold">
                      {log.action.replace(/_/g, " ")}
                    </span>
                    <span className="text-muted">
                      {formatDate(log.createdAt)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 lg:gap-3">
          <Card className="p-4">
            <HardDrive className="h-5 w-5 text-foreground" />
            <h2 className="mt-2 text-[14px] font-bold">Storage</h2>
            <p className="mt-1 text-[12px] text-muted">
              Connected accounts: {accounts.length}
            </p>
          </Card>
          <Card className="p-4">
            <Bell className="h-5 w-5 text-foreground" />
            <h2 className="mt-2 text-[14px] font-bold">Notifications</h2>
            <p className="mt-1 text-[12px] text-muted">
              Email and app alerts are active.
            </p>
          </Card>
          <Card className="p-4">
            <Globe className="h-5 w-5 text-foreground" />
            <h2 className="mt-2 text-[14px] font-bold">Region</h2>
            <p className="mt-1 text-[12px] text-muted">
              Workspace region: local gateway.
            </p>
          </Card>
        </div>
      </div>

      <DummyModal
        open={s3Open}
        title="Connect S3 Storage"
        description="Use any S3-compatible provider with custom endpoint support."
        onClose={() => setS3Open(false)}
      >
        <form className="grid gap-4" onSubmit={connectS3}>
          <Input
            fullWidth
            placeholder="Display name"
            value={s3Form.name}
            onChange={(event) =>
              setS3Form({ ...s3Form, name: event.target.value })
            }
            required
          />
          <Input
            fullWidth
            placeholder="Bucket"
            value={s3Form.bucket}
            onChange={(event) =>
              setS3Form({ ...s3Form, bucket: event.target.value })
            }
            required
          />
          <Input
            fullWidth
            placeholder="Region"
            value={s3Form.region}
            onChange={(event) =>
              setS3Form({ ...s3Form, region: event.target.value })
            }
            required
          />
          <Input
            fullWidth
            placeholder="Endpoint URL (optional)"
            value={s3Form.endpoint}
            onChange={(event) =>
              setS3Form({ ...s3Form, endpoint: event.target.value })
            }
          />
          <Input
            fullWidth
            placeholder="Access key ID"
            value={s3Form.accessKeyId}
            onChange={(event) =>
              setS3Form({ ...s3Form, accessKeyId: event.target.value })
            }
            required
          />
          <Input
            fullWidth
            placeholder="Secret access key"
            type="password"
            value={s3Form.secretAccessKey}
            onChange={(event) =>
              setS3Form({ ...s3Form, secretAccessKey: event.target.value })
            }
            required
          />
          <Input
            fullWidth
            placeholder="Quota bytes (optional)"
            inputMode="numeric"
            value={s3Form.quotaBytes}
            onChange={(event) =>
              setS3Form({ ...s3Form, quotaBytes: event.target.value })
            }
          />
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={s3Form.forcePathStyle}
              onChange={(event) =>
                setS3Form({ ...s3Form, forcePathStyle: event.target.checked })
              }
            />
            Force path style
          </label>
          <div className="grid gap-3 sm:flex sm:justify-end">
            <Button
              variant="outline"
              type="button"
              onPress={() => setS3Open(false)}
              isDisabled={connectingS3}
            >
              Cancel
            </Button>
            <Button type="submit" isDisabled={connectingS3}>
              {connectingS3 ? "Connecting..." : "Connect S3"}
            </Button>
          </div>
        </form>
      </DummyModal>

      <DummyModal
        open={Boolean(accountToDisconnect)}
        title="Disconnect storage?"
        description="This will remove this storage account from ArchiveCloud."
        onClose={() => setAccountToDisconnect(null)}
      >
        <div className="grid gap-4">
          <div className="rounded-xl bg-background-secondary p-4 text-sm text-muted">
            <p className="font-semibold text-foreground">
              {accountToDisconnect?.email}
            </p>
            <p className="mt-1">
              Used storage:{" "}
              {formatBytes(accountToDisconnect?.storageAccount?.usedBytes)}
            </p>
          </div>
          <div className="grid gap-3 sm:flex sm:justify-end">
            <Button
              variant="outline"
              onPress={() => setAccountToDisconnect(null)}
              isDisabled={Boolean(disconnectingAccountId)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onPress={disconnect}
              isDisabled={Boolean(disconnectingAccountId)}
            >
              <TrashBin className="h-4 w-4" />
              {disconnectingAccountId ? "Disconnecting..." : "Disconnect"}
            </Button>
          </div>
        </div>
      </DummyModal>
    </>
  );
}
