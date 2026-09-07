"use client";

import { Button, toast } from "@heroui/react";
import {
  ArrowRotateRight,
  Bell,
  Globe,
  HardDrive,
  Link,
  TrashBin,
} from "@gravity-ui/icons";
import { useEffect, useState } from "react";
import { GoogleDriveLogo } from "@/components/drive/GoogleDriveLogo";
import { DummyModal } from "@/components/drive/DummyModal";
import { PageHeader } from "@/components/drive/PageHeader";
import { apiFetch, formatBytes } from "@/lib/api";

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

function providerLabel(_provider: string) {
  return "Google Drive";
}

function storageLimitLabel(account: ConnectedAccount) {
  return formatBytes(account.storageAccount?.totalBytes);
}

function availableLabel(account: ConnectedAccount) {
  return formatBytes(account.storageAccount?.availableBytes);
}

export function SettingsPage() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const [disconnectingAccountId, setDisconnectingAccountId] = useState<
    string | null
  >(null);
  const [accountToDisconnect, setAccountToDisconnect] =
    useState<ConnectedAccount | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState("");

  const selectedAccount =
    accounts.find((account) => account.id === selectedAccountId) ??
    accounts[0] ??
    null;

  async function load() {
    const accountsData = await apiFetch<{ accounts: ConnectedAccount[] }>(
      "/connected-accounts",
    );
    setAccounts(accountsData.accounts);
  }

  useEffect(() => {
    load().catch((error) =>
      toast.danger(
        error instanceof Error ? error.message : "Failed to load settings",
      ),
    );
  }, []);

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

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage connected Google Drive accounts and preferences."
        actions={
          <Button size="sm" onPress={connectDrive} isDisabled={connecting}>
            <Link className="h-4 w-4" />
            {connecting ? "Connecting..." : "Connect Drive"}
          </Button>
        }
      />
      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="grid gap-4">
          <section className="overflow-hidden">
            <div className="flex items-center gap-2.5">
              <GoogleDriveLogo className="h-5 w-5" />
              <h2 className="text-[16px] font-bold">Google Drive</h2>
            </div>
            <p className="mt-1 text-[13px] text-muted">
              Connect Google Drive accounts to store and sync your files.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-bold">
              Connected Storage Accounts
            </h2>
            <div className="mt-3.5 grid gap-3">
              {accounts.length === 0 ? (
                <div className="flex min-h-[120px] items-center justify-center py-6">
                  <p className="text-center text-sm text-muted">
                    No connected storage account yet.
                  </p>
                </div>
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
                    <div className="rounded-xl p-3">
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
          </section>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 lg:gap-3">
          <section>
            <HardDrive className="h-5 w-5 text-foreground" />
            <h2 className="mt-2 text-[14px] font-bold">Storage</h2>
            <p className="mt-1 text-[12px] text-muted">
              Connected accounts: {accounts.length}
            </p>
          </section>
          <section>
            <Bell className="h-5 w-5 text-foreground" />
            <h2 className="mt-2 text-[14px] font-bold">Notifications</h2>
            <p className="mt-1 text-[12px] text-muted">
              Email and app alerts are active.
            </p>
          </section>
          <section>
            <Globe className="h-5 w-5 text-foreground" />
            <h2 className="mt-2 text-[14px] font-bold">Region</h2>
            <p className="mt-1 text-[12px] text-muted">
              Local gateway deployment.
            </p>
          </section>
        </div>
      </div>

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
              className={disconnectingAccountId ? "opacity-50" : undefined}
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
