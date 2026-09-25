import { toast } from "@heroui/react";
import { type Dispatch, type SetStateAction, useEffect, useRef } from "react";
import { apiFetch, isAbortError, isNetworkError } from "@/lib/api";
import type { ConnectedAccount } from "@/views/all-files/types";

export function useHomeConnectedAccounts(args: {
  loadAll: () => Promise<void>;
  setConnectedAccounts: Dispatch<SetStateAction<ConnectedAccount[]>>;
  setAccountsLoaded: Dispatch<SetStateAction<boolean>>;
  setSyncingDrive: Dispatch<SetStateAction<boolean>>;
}) {
  const { loadAll, setConnectedAccounts, setAccountsLoaded, setSyncingDrive } =
    args;
  const loadAllRef = useRef(loadAll);
  loadAllRef.current = loadAll;

  useEffect(() => {
    const controller = new AbortController();
    const AUTO_SYNC_COOLDOWN_MS = 5 * 60 * 1000;
    const AUTO_SYNC_STORAGE_KEY = "archivecloud:last-drive-auto-sync";

    async function loadConnectedAccountsAndSync() {
      try {
        const data = await apiFetch<{ accounts: ConnectedAccount[] }>(
          "/connected-accounts",
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        const accounts = data.accounts || [];
        setConnectedAccounts(accounts);
        setAccountsLoaded(true);

        const hasGoogleDrive = accounts.some(
          (account) =>
            account.provider === "google_drive" &&
            account.status === "connected",
        );
        if (!hasGoogleDrive) return;

        const lastSyncAt = Number(
          sessionStorage.getItem(AUTO_SYNC_STORAGE_KEY) ?? "0",
        );
        if (
          Number.isFinite(lastSyncAt) &&
          Date.now() - lastSyncAt < AUTO_SYNC_COOLDOWN_MS
        ) {
          return;
        }

        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 750);
        });
        if (controller.signal.aborted) return;

        setSyncingDrive(true);
        try {
          const response = await apiFetch<{
            results: { created: number; updated: number; deleted: number }[];
          }>("/files/sync-google", {
            method: "POST",
            body: JSON.stringify({}),
            signal: controller.signal,
          });
          if (controller.signal.aborted) return;

          sessionStorage.setItem(AUTO_SYNC_STORAGE_KEY, String(Date.now()));

          let created = 0;
          for (const res of response.results) created += res.created;
          await loadAllRef.current();
          window.dispatchEvent(new Event("archivecloud:storage-changed"));
          if (created > 0) {
            toast.success(
              `Imported ${created} file${created === 1 ? "" : "s"} from Google Drive.`,
            );
          }
        } catch (error) {
          if (isAbortError(error)) return;
          if (isNetworkError(error)) {
            console.warn("Auto sync Google Drive skipped (network).");
            return;
          }
          console.warn("Auto sync Google Drive failed:", error);
        } finally {
          if (!controller.signal.aborted) setSyncingDrive(false);
        }
      } catch (error) {
        if (isAbortError(error)) return;
        setAccountsLoaded(true);
        console.warn("Failed to load connected accounts:", error);
      }
    }

    async function refreshConnectedAccounts() {
      try {
        const data = await apiFetch<{ accounts: ConnectedAccount[] }>(
          "/connected-accounts",
        );
        setConnectedAccounts(data.accounts || []);
        setAccountsLoaded(true);
      } catch (error) {
        console.warn("Failed to refresh connected accounts:", error);
      }
    }

    function onStorageChanged() {
      void refreshConnectedAccounts();
    }

    window.addEventListener("archivecloud:storage-changed", onStorageChanged);
    void loadConnectedAccountsAndSync();
    return () => {
      controller.abort();
      window.removeEventListener(
        "archivecloud:storage-changed",
        onStorageChanged,
      );
    };
  }, []);

  async function syncGoogleDrive() {
    setSyncingDrive(true);
    try {
      const response = await apiFetch<{
        results: { created: number; updated: number; deleted: number }[];
      }>("/files/sync-google", { method: "POST", body: JSON.stringify({}) });

      let created = 0,
        updated = 0,
        deleted = 0;
      for (const res of response.results) {
        created += res.created;
        updated += res.updated;
        deleted += res.deleted;
      }
      const accounts = response.results.length;

      toast.success(
        `Google Drive synced. ${created} added, ${updated} updated, ${deleted} removed across ${accounts} account${accounts === 1 ? "" : "s"}.`,
      );
      await loadAll();
      window.dispatchEvent(new Event("archivecloud:storage-changed"));
    } catch (error) {
      toast.danger(
        error instanceof Error ? error.message : "Failed to sync Google Drive",
      );
    } finally {
      setSyncingDrive(false);
    }
  }

  return { syncGoogleDrive };
}
