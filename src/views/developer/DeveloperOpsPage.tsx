"use client";

import { authClient } from "@/lib/auth-client";
import { Button, Card } from "@heroui/react";
import { ArrowRotateRight, Database, HardDrive } from "@gravity-ui/icons";
import { useEffect, useRef, useState } from "react";
import { DummyModal } from "@/components/drive/DummyModal";
import { PageHeader } from "@/components/drive/PageHeader";
import { API_URL, apiFetch } from "@/lib/api";

export function DeveloperOpsPage() {
  const signOut = () => authClient.signOut();
  const [updatingSystem, setUpdatingSystem] = useState(false);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateModalTitle, setUpdateModalTitle] = useState("");
  const [isPollingLog, setIsPollingLog] = useState(false);
  const [updateLog, setUpdateLog] = useState("");
  const [updateFinished, setUpdateFinished] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState<boolean | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreMessage, setRestoreMessage] = useState("");
  const [restoreSuccess, setRestoreSuccess] = useState(false);

  async function downloadBackup() {
    setDownloadingBackup(true);
    try {
      const response = await fetch(`${API_URL}/system/backup`, {
        credentials: "same-origin",
      });
      if (!response.ok) {
        throw new Error("Failed to retrieve database backup.");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "archivecloud-backup.sql";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Download failed.";
      alert(`Failed to download backup: ${msg}`);
    } finally {
      setDownloadingBackup(false);
    }
  }

  function handleRestoreFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) {
      setRestoreFile(e.target.files[0]);
    } else {
      setRestoreFile(null);
    }
  }

  async function restoreBackup() {
    if (!restoreFile) return;
    if (
      !confirm(
        "WARNING: Restoring database will overwrite all current data. The server will restart. Continue?",
      )
    ) {
      return;
    }

    setRestoringBackup(true);
    setRestoreMessage("");
    setRestoreSuccess(false);

    try {
      const formData = new FormData();
      formData.append("file", restoreFile);

      const response = await fetch(`${API_URL}/system/restore`, {
        method: "POST",
        credentials: "same-origin",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to restore database.");
      }

      setRestoreSuccess(true);
      setRestoreMessage(
        data.message ||
          "Database restored successfully! Logging you out and reloading...",
      );

      setTimeout(async () => {
        await signOut();
        window.location.href = "/signin";
      }, 4000);
    } catch (err: unknown) {
      setRestoreSuccess(false);
      setRestoreMessage(
        err instanceof Error ? err.message : "Failed to restore database.",
      );
    } finally {
      setRestoringBackup(false);
    }
  }

  useEffect(() => {
    if (!isPollingLog) return;

    let intervalId: ReturnType<typeof setInterval>;
    let active = true;

    async function fetchLog() {
      try {
        const data = await apiFetch<{ log: string }>("/system/update-log");
        if (!active) return;

        setUpdateLog(data.log);
        setReconnectCount(0);

        if (data.log.includes("=== System Update Completed:")) {
          setUpdateFinished(true);
          setUpdateSuccess(true);
          setIsPollingLog(false);
          setUpdateModalTitle("System Updated");
        }
      } catch {
        if (!active) return;
        setReconnectCount((prev) => prev + 1);
      }
    }

    fetchLog();
    intervalId = setInterval(fetchLog, 2000);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [isPollingLog]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [updateLog]);

  async function runSystemUpdate() {
    setUpdatingSystem(true);
    setUpdateLog("Initiating system update in the background...\n");
    setUpdateFinished(false);
    setUpdateSuccess(null);
    setReconnectCount(0);
    setUpdateModalTitle("System Updating");
    setUpdateModalOpen(true);

    try {
      await apiFetch<{ message: string }>("/system/update", { method: "POST" });
      setIsPollingLog(true);
    } catch (error) {
      setUpdateModalTitle("System Update Failed");
      const errMsg =
        error instanceof Error
          ? error.message
          : "System update failed to initiate.";
      setUpdateLog((prev) => `${prev}\nError: ${errMsg}`);
      setUpdateFinished(true);
      setUpdateSuccess(false);
    } finally {
      setUpdatingSystem(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Operations"
        description="Update application code and manage database backups."
      />

      <div className="mt-5 grid gap-4">
        <Card className="overflow-hidden p-3.5">
          <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <ArrowRotateRight className="h-5 w-5 text-foreground" />
                <h2 className="text-[16px] font-bold">System Update</h2>
              </div>
              <p className="mt-1 text-[13px] text-muted">
                Pull the latest code from GitHub. Dev servers will automatically
                restart.
              </p>
            </div>
            <Button
              className="w-full sm:w-32"
              variant="outline"
              size="sm"
              onClick={runSystemUpdate}
              isDisabled={updatingSystem}
            >
              <ArrowRotateRight
                className={updatingSystem ? "h-4 w-4 animate-spin" : "h-4 w-4"}
              />
              {updatingSystem ? "Updating..." : "Update Code"}
            </Button>
          </div>
        </Card>

        <Card className="overflow-hidden p-3.5">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-separator pb-3">
              <div className="flex items-center gap-2.5">
                <Database className="h-5 w-5 text-foreground" />
                <h2 className="text-[16px] font-bold">
                  Backup & Restore Database
                </h2>
              </div>
              <span className="text-[11px] text-muted font-semibold uppercase tracking-wider">
                PostgreSQL
              </span>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="rounded-2xl bg-surface-secondary border border-border p-5 flex flex-col justify-between">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-default flex items-center justify-center">
                    <HardDrive className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">Download Backup</h3>
                    <p className="mt-1 text-[12px] text-muted leading-normal">
                      Save accounts, folders, file metadata, and configurations.
                    </p>
                  </div>
                </div>
                <Button
                  className="mt-5 w-full"
                  onClick={downloadBackup}
                  isDisabled={downloadingBackup}
                >
                  <HardDrive className="h-4 w-4" />
                  {downloadingBackup ? "Downloading..." : "Download Backup"}
                </Button>
              </div>

              <div className="rounded-2xl bg-surface-secondary border border-border p-5 flex flex-col justify-between">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-default flex items-center justify-center">
                    <ArrowRotateRight className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">Restore Backup</h3>
                    <p className="mt-1 text-[12px] text-muted leading-normal">
                      Upload a previously downloaded ArchiveCloud SQL backup
                      file.
                    </p>
                  </div>
                </div>
                <div className="mt-5 grid gap-3">
                  <input
                    type="file"
                    accept=".sql"
                    onChange={handleRestoreFileChange}
                    className="text-xs"
                  />
                  <Button
                    variant="danger"
                    onClick={restoreBackup}
                    isDisabled={!restoreFile || restoringBackup}
                  >
                    {restoringBackup ? "Restoring..." : "Restore Database"}
                  </Button>
                </div>
              </div>
            </div>

            {restoreMessage ? (
              <p
                className={
                  restoreSuccess
                    ? "rounded-xl bg-surface-secondary p-3 text-xs font-semibold text-foreground"
                    : "rounded-xl bg-danger-soft p-3 text-xs font-semibold text-danger-soft-foreground"
                }
              >
                {restoreMessage}
              </p>
            ) : null}
          </div>
        </Card>
      </div>

      <DummyModal
        open={updateModalOpen}
        title={updateModalTitle}
        description={
          updateFinished
            ? updateSuccess
              ? "System updated successfully"
              : "Update failed"
            : "Live installation logs"
        }
        className="max-w-2xl"
        onClose={() => {
          if (!updateFinished) {
            if (
              !confirm(
                "The update is still running in the background. Close log viewer?",
              )
            ) {
              return;
            }
          }
          setUpdateModalOpen(false);
          setIsPollingLog(false);
          if (updateFinished && updateSuccess) {
            window.location.reload();
          }
        }}
      >
        <div className="grid gap-4">
          <div
            ref={logContainerRef}
            className="relative rounded-xl bg-background-inverse p-4 font-mono text-xs text-background leading-relaxed border border-border h-80 overflow-y-auto select-text"
          >
            <pre className="whitespace-pre-wrap">{updateLog}</pre>
            {!updateFinished ? (
              <div className="mt-3 flex items-center gap-2 text-muted">
                <ArrowRotateRight className="h-3.5 w-3.5 animate-spin" />
                <span>
                  {reconnectCount > 0
                    ? `Rebooting server and reconnecting... (attempt ${reconnectCount})`
                    : "Installing updates..."}
                </span>
              </div>
            ) : null}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (!updateFinished) {
                  if (
                    !confirm("The update is still running. Close log viewer?")
                  ) {
                    return;
                  }
                }
                setUpdateModalOpen(false);
                setIsPollingLog(false);
                if (updateFinished && updateSuccess) {
                  window.location.reload();
                }
              }}
            >
              Close
            </Button>
            {updateFinished && updateSuccess ? (
              <Button onClick={() => window.location.reload()}>
                Reload Page
              </Button>
            ) : null}
          </div>
        </div>
      </DummyModal>
    </>
  );
}
