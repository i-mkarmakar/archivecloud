"use client";

import {
  ArrowRight,
  Cloud,
  Copy,
  FolderOpen,
  TrashBin,
} from "@gravity-ui/icons";
import { Input } from "@heroui/react";
import type { FileItem } from "@/data/drive-data";
import { cn } from "@/lib/utils";
import {
  accountLabel,
  type BrowseFolder,
  type ConnectedAccountOption,
  type ScheduleKind,
  type ScheduleOperation,
} from "./types";
import { OpCard, PickerSelect, ScheduleStep } from "./ui";

export function OperationStep({
  operation,
  onChange,
}: {
  operation: ScheduleOperation;
  onChange: (op: ScheduleOperation) => void;
}) {
  return (
    <ScheduleStep
      n={1}
      title="Operation"
      description="What should run on schedule?"
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <OpCard
          active={operation === "copy"}
          label="Copy files"
          tone="violet"
          icon={<Copy className="h-4 w-4" />}
          onClick={() => onChange("copy")}
        />
        <OpCard
          active={operation === "move"}
          label="Move files"
          tone="amber"
          icon={<ArrowRight className="h-4 w-4" />}
          onClick={() => onChange("move")}
        />
        <OpCard
          active={operation === "delete"}
          label="Delete files"
          tone="rose"
          icon={<TrashBin className="h-4 w-4" />}
          onClick={() => onChange("delete")}
        />
      </div>
    </ScheduleStep>
  );
}

export function SourceStep({
  accounts,
  accountsLoading,
  files,
  filesLoading,
  sourceAccountId,
  sourceFileId,
  onAccountChange,
  onFileChange,
}: {
  accounts: ConnectedAccountOption[];
  accountsLoading: boolean;
  files: FileItem[];
  filesLoading: boolean;
  sourceAccountId: string;
  sourceFileId: string;
  onAccountChange: (id: string) => void;
  onFileChange: (id: string) => void;
}) {
  return (
    <ScheduleStep
      n={2}
      title="Source folder"
      description="Pick the folder whose contents will be processed."
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <PickerSelect
          value={sourceAccountId}
          disabled={accountsLoading}
          placeholder="Pick a source account"
          icon={<Cloud className="h-3.5 w-3.5" />}
          options={accounts.map((a) => ({
            id: a.id,
            label: accountLabel(a),
          }))}
          onChange={onAccountChange}
        />
        <PickerSelect
          value={sourceFileId}
          disabled={!sourceAccountId || filesLoading}
          placeholder={
            !sourceAccountId
              ? "Pick a source account first"
              : filesLoading
                ? "Loading…"
                : files.length
                  ? "Pick a source file"
                  : "No files on this account"
          }
          icon={<FolderOpen className="h-3.5 w-3.5" />}
          options={files.map((f) => ({
            id: f.id!,
            label: f.folderName ? `${f.folderName} / ${f.name}` : f.name,
          }))}
          onChange={onFileChange}
        />
      </div>
    </ScheduleStep>
  );
}

export function DestinationStep({
  operation,
  accounts,
  accountsLoading,
  destAccountId,
  destParentId,
  destFolders,
  destFoldersLoading,
  onAccountChange,
  onFolderChange,
}: {
  operation: Exclude<ScheduleOperation, "delete">;
  accounts: ConnectedAccountOption[];
  accountsLoading: boolean;
  destAccountId: string;
  destParentId: string;
  destFolders: BrowseFolder[];
  destFoldersLoading: boolean;
  onAccountChange: (id: string) => void;
  onFolderChange: (id: string) => void;
}) {
  const description =
    operation === "move"
      ? "Where moved items will land."
      : "Where copied items will land.";

  const folderOptions = [
    { id: "root", label: "Root / default" },
    ...destFolders.map((f) => ({ id: f.id, label: f.name })),
  ];

  return (
    <ScheduleStep n={3} title="Destination folder" description={description}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <PickerSelect
          value={destAccountId}
          disabled={accountsLoading}
          placeholder="Pick a destination account"
          icon={<Cloud className="h-3.5 w-3.5" />}
          options={accounts.map((a) => ({
            id: a.id,
            label: accountLabel(a),
          }))}
          onChange={onAccountChange}
        />
        <PickerSelect
          value={destAccountId ? destParentId || "root" : ""}
          disabled={!destAccountId || destFoldersLoading}
          placeholder={
            !destAccountId
              ? "Pick a destination account first"
              : destFoldersLoading
                ? "Loading folders…"
                : "Pick a destination folder"
          }
          icon={<FolderOpen className="h-3.5 w-3.5" />}
          options={destAccountId ? folderOptions : []}
          onChange={onFolderChange}
        />
      </div>
    </ScheduleStep>
  );
}

export function WhenToRunStep({
  stepNumber,
  tz,
  scheduleKind,
  runDate,
  runTime,
  fireLabel,
  onKindChange,
  onDateChange,
  onTimeChange,
}: {
  stepNumber: number;
  tz: string;
  scheduleKind: ScheduleKind;
  runDate: string;
  runTime: string;
  fireLabel: string;
  onKindChange: (kind: ScheduleKind) => void;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
}) {
  return (
    <ScheduleStep
      n={stepNumber}
      title="When to run"
      description={`All times are shown and entered in your local timezone (${tz}).`}
    >
      <div className="inline-flex w-full gap-0.5 rounded-lg bg-[#f1f4f7] p-0.5">
        {(
          [
            ["once", "One-time"],
            ["daily", "Daily"],
            ["weekly", "Weekly"],
            ["monthly", "Monthly"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => onKindChange(key)}
            className={cn(
              "flex-1 rounded-md px-2 py-1.5 text-xs font-bold transition-colors",
              scheduleKind === key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-white hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <label
          htmlFor="schedule-run-date"
          className="grid w-[11.5rem] gap-1 text-xs font-semibold text-foreground"
        >
          Date ({tz})
          <Input
            id="schedule-run-date"
            type="date"
            value={runDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="h-9 rounded-full border border-border bg-white text-xs"
          />
        </label>
        <label
          htmlFor="schedule-run-time"
          className="grid w-[9.5rem] gap-1 text-xs font-semibold text-foreground"
        >
          Run time ({tz})
          <Input
            id="schedule-run-time"
            type="time"
            value={runTime}
            onChange={(e) => onTimeChange(e.target.value)}
            className="h-9 rounded-full border border-border bg-white text-xs"
          />
        </label>
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Will fire at {fireLabel}
        {scheduleKind !== "once" ? ` · repeats ${scheduleKind}` : ""}
      </p>
    </ScheduleStep>
  );
}

function ScheduleAutoNameParts({
  operation,
  sourceName,
  destFolderName,
  className,
}: {
  operation: ScheduleOperation;
  sourceName?: string | null;
  destFolderName?: string | null;
  className?: string;
}) {
  const op =
    operation === "delete" ? "Delete" : operation === "move" ? "Move" : "Copy";
  const from = sourceName || "folder";
  if (operation === "delete") {
    return <span className={className}>{`${op} ${from}`}</span>;
  }
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {op} {from}
      <ArrowRight className="size-3 shrink-0" />
      {destFolderName || "folder"}
    </span>
  );
}

export function NameStep({
  stepNumber,
  name,
  operation,
  sourceName,
  destFolderName,
  onChange,
}: {
  stepNumber: number;
  name: string;
  operation: ScheduleOperation;
  sourceName?: string | null;
  destFolderName?: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <ScheduleStep
      n={stepNumber}
      title="Name & confirm"
      description="A friendly label for this schedule. Leave blank to auto-derive."
      isLast
    >
      <div className="relative">
        <Input
          value={name}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 rounded-full border border-border bg-white text-xs"
        />
        {!name.trim() ? (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs text-muted-foreground">
            <ScheduleAutoNameParts
              operation={operation}
              sourceName={sourceName}
              destFolderName={destFolderName}
            />
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
        Leave blank to auto-derive:
        <ScheduleAutoNameParts
          operation={operation}
          sourceName={sourceName}
          destFolderName={destFolderName}
          className="font-semibold text-foreground"
        />
      </p>
    </ScheduleStep>
  );
}
