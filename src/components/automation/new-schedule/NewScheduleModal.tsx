"use client";

import { CircleInfo, Xmark } from "@gravity-ui/icons";
import { Button } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { FileItem } from "@/data/drive-data";
import { apiFetch } from "@/lib/api";
import { ScheduleSummary } from "./ScheduleSummary";
import {
  DestinationStep,
  NameStep,
  OperationStep,
  SourceStep,
  WhenToRunStep,
} from "./steps";
import {
  buildAutoName,
  combineLocalToIso,
  defaultLocalDateTime,
  filesForAccount,
  formatFireLabel,
  localTimezone,
  scheduleKindLabel,
  type BrowseFolder,
  type ConnectedAccountOption,
  type CreateSchedulePayload,
  type ScheduleKind,
  type ScheduleOperation,
} from "./types";

export type {
  ConnectedAccountOption,
  CreateSchedulePayload,
  ScheduleKind,
  ScheduleOperation,
} from "./types";

type Props = {
  open: boolean;
  onClose: () => void;
  accounts: ConnectedAccountOption[];
  accountsLoading: boolean;
  files: FileItem[];
  filesLoading: boolean;
  creating: boolean;
  onCreate: (payload: CreateSchedulePayload) => Promise<void>;
};

export function NewScheduleModal({
  open,
  onClose,
  accounts,
  accountsLoading,
  files,
  filesLoading,
  creating,
  onCreate,
}: Props) {
  const tz = useMemo(() => localTimezone(), []);
  const defaults = useMemo(() => defaultLocalDateTime(), []);

  const [operation, setOperation] = useState<ScheduleOperation>("copy");
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [sourceFileId, setSourceFileId] = useState("");
  const [destAccountId, setDestAccountId] = useState("");
  const [destParentId, setDestParentId] = useState("");
  const [destFolders, setDestFolders] = useState<BrowseFolder[]>([]);
  const [destFoldersLoading, setDestFoldersLoading] = useState(false);
  const [scheduleKind, setScheduleKind] = useState<ScheduleKind>("once");
  const [runDate, setRunDate] = useState(defaults.date);
  const [runTime, setRunTime] = useState(defaults.time);
  const [name, setName] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const d = defaultLocalDateTime();
    setOperation("copy");
    setSourceAccountId("");
    setSourceFileId("");
    setDestAccountId("");
    setDestParentId("");
    setDestFolders([]);
    setScheduleKind("once");
    setRunDate(d.date);
    setRunTime(d.time);
    setName("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !destAccountId || operation === "delete") {
      setDestFolders([]);
      return;
    }
    let cancelled = false;
    setDestFoldersLoading(true);
    void apiFetch<{ folders?: BrowseFolder[] }>(
      `/connected-accounts/${destAccountId}/browse?parentId=root`,
    )
      .then((data) => {
        if (!cancelled) setDestFolders(data.folders ?? []);
      })
      .catch(() => {
        if (!cancelled) setDestFolders([]);
      })
      .finally(() => {
        if (!cancelled) setDestFoldersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, destAccountId, operation]);

  const sourceFiles = useMemo(
    () => filesForAccount(files, sourceAccountId),
    [files, sourceAccountId],
  );
  const selectedFile = useMemo(
    () => sourceFiles.find((f) => f.id === sourceFileId) ?? null,
    [sourceFiles, sourceFileId],
  );
  const sourceAccount = accounts.find((a) => a.id === sourceAccountId) ?? null;
  const destAccount = accounts.find((a) => a.id === destAccountId) ?? null;
  const selectedDestFolder =
    destFolders.find((f) => f.id === destParentId) ?? null;

  const autoName = useMemo(
    () =>
      buildAutoName({
        operation,
        sourceName: selectedFile?.name,
        destFolderName: selectedDestFolder?.name,
      }),
    [operation, selectedFile, selectedDestFolder],
  );

  const startAt = useMemo(
    () => combineLocalToIso(runDate, runTime),
    [runDate, runTime],
  );
  const fireLabel = formatFireLabel(startAt, tz);
  const kindLabel = scheduleKindLabel(scheduleKind);
  const showDest = operation !== "delete";
  const whenStep = showDest ? 4 : 3;
  const nameStep = showDest ? 5 : 4;

  const canSubmit =
    Boolean(sourceFileId) &&
    (operation === "delete" || Boolean(destAccountId)) &&
    Boolean(startAt);

  async function handleCreate() {
    if (!sourceFileId || !startAt) return;
    await onCreate({
      sourceFileId,
      destAccountId: operation === "delete" ? undefined : destAccountId,
      destParentId:
        operation === "delete" || !destParentId ? null : destParentId,
      operation,
      scheduleKind,
      startAt: startAt.toISOString(),
      name: name.trim() || autoName,
    });
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center p-3 sm:p-4"
      style={{ zIndex: 100000 }}
    >
      <button
        type="button"
        aria-label="Close overlay"
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-schedule-title"
        className="relative z-10 flex max-h-[min(720px,calc(100dvh-1.5rem))] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between bg-[#1e9df1] px-4 py-2.5 text-white">
          <h2 id="new-schedule-title" className="text-base font-extrabold">
            New schedule
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 hover:bg-white/15"
            aria-label="Close"
          >
            <Xmark className="h-4 w-4" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="min-h-0 space-y-4 overflow-y-auto px-4 py-3 sm:px-4">
            <OperationStep
              operation={operation}
              onChange={(op) => {
                setOperation(op);
                if (op === "delete") {
                  setDestAccountId("");
                  setDestParentId("");
                }
              }}
            />

            <SourceStep
              accounts={accounts}
              accountsLoading={accountsLoading}
              files={sourceFiles}
              filesLoading={filesLoading}
              sourceAccountId={sourceAccountId}
              sourceFileId={sourceFileId}
              onAccountChange={(id) => {
                setSourceAccountId(id);
                setSourceFileId("");
              }}
              onFileChange={setSourceFileId}
            />

            {showDest ? (
              <DestinationStep
                operation={operation}
                accounts={accounts}
                accountsLoading={accountsLoading}
                destAccountId={destAccountId}
                destParentId={destParentId}
                destFolders={destFolders}
                destFoldersLoading={destFoldersLoading}
                onAccountChange={(id) => {
                  setDestAccountId(id);
                  setDestParentId("");
                }}
                onFolderChange={(id) =>
                  setDestParentId(id === "root" ? "" : id)
                }
              />
            ) : null}

            <WhenToRunStep
              stepNumber={whenStep}
              tz={tz}
              scheduleKind={scheduleKind}
              runDate={runDate}
              runTime={runTime}
              fireLabel={fireLabel}
              onKindChange={setScheduleKind}
              onDateChange={setRunDate}
              onTimeChange={setRunTime}
            />

            <NameStep
              stepNumber={nameStep}
              name={name}
              autoName={autoName}
              onChange={setName}
            />
          </div>

          <ScheduleSummary
            operation={operation}
            kindLabel={kindLabel}
            fireLabel={fireLabel}
            startAt={startAt}
            sourceAccount={sourceAccount}
            destAccount={destAccount}
            sourceName={selectedFile?.name ?? null}
            destFolderName={selectedDestFolder?.name ?? null}
            showDest={showDest}
          />
        </div>

        <footer className="flex shrink-0 flex-col gap-2 border-t border-border bg-white px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CircleInfo className="h-3.5 w-3.5 shrink-0" />
            All set. Review the summary on the right.
          </p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onPress={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              isDisabled={!canSubmit || creating}
              onPress={() => {
                void handleCreate();
              }}
            >
              {creating ? "Creating…" : "Create schedule"}
            </Button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
