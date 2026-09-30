"use client";

import {
  ArrowRight,
  ArrowsRotateRight,
  CircleInfo,
  Cloud,
  FolderOpen,
  Xmark,
} from "@gravity-ui/icons";
import { Button, Input } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  PickerSelect,
  ScheduleStep,
} from "@/components/automation/new-schedule/ui";
import { apiFetch } from "@/lib/api";
import { providerLabel } from "@/lib/providers";
import { cn } from "@/lib/utils";

export type SyncPairAccount = {
  id: string;
  email: string;
  displayName?: string | null;
  provider: string;
};

export type CreateSyncPairPayload = {
  sourceAccountId: string;
  destAccountId: string;
  sourceParentId: string;
  destParentId: string;
  direction: "one_way" | "two_way";
  sourceLabel: string | null;
};

type BrowseFolder = { id: string; name: string };

type Props = {
  open: boolean;
  onClose: () => void;
  accounts: SyncPairAccount[];
  accountsLoading: boolean;
  creating: boolean;
  onCreate: (payload: CreateSyncPairPayload) => Promise<void>;
};

function accountLabel(account: SyncPairAccount) {
  return `${providerLabel(account.provider)} · ${account.displayName || account.email}`;
}

async function loadFolders(accountId: string): Promise<BrowseFolder[]> {
  const data = await apiFetch<{ folders: BrowseFolder[] }>(
    `/connected-accounts/${accountId}/browse?parentId=root`,
  );
  return data.folders ?? [];
}

export function NewSyncPairModal({
  open,
  onClose,
  accounts,
  accountsLoading,
  creating,
  onCreate,
}: Props) {
  const [direction, setDirection] = useState<"one_way" | "two_way">("one_way");
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [sourceParentId, setSourceParentId] = useState("");
  const [destAccountId, setDestAccountId] = useState("");
  const [destParentId, setDestParentId] = useState("");
  const [sourceFolders, setSourceFolders] = useState<BrowseFolder[]>([]);
  const [destFolders, setDestFolders] = useState<BrowseFolder[]>([]);
  const [sourceFoldersLoading, setSourceFoldersLoading] = useState(false);
  const [destFoldersLoading, setDestFoldersLoading] = useState(false);
  const [name, setName] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setDirection("one_way");
    setSourceAccountId("");
    setDestAccountId("");
    setSourceParentId("");
    setDestParentId("");
    setSourceFolders([]);
    setDestFolders([]);
    setName("");
  }, [open]);

  useEffect(() => {
    if (!sourceAccountId) {
      setSourceFolders([]);
      return;
    }
    let cancelled = false;
    setSourceFoldersLoading(true);
    loadFolders(sourceAccountId)
      .then((folders) => {
        if (!cancelled) setSourceFolders(folders);
      })
      .catch(() => {
        if (!cancelled) setSourceFolders([]);
      })
      .finally(() => {
        if (!cancelled) setSourceFoldersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sourceAccountId]);

  useEffect(() => {
    if (!destAccountId) {
      setDestFolders([]);
      return;
    }
    let cancelled = false;
    setDestFoldersLoading(true);
    loadFolders(destAccountId)
      .then((folders) => {
        if (!cancelled) setDestFolders(folders);
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
  }, [destAccountId]);

  const sourceAccount = accounts.find((a) => a.id === sourceAccountId) ?? null;
  const destAccount = accounts.find((a) => a.id === destAccountId) ?? null;
  const sourceFolderName =
    sourceParentId === "root" || !sourceParentId
      ? "Root"
      : (sourceFolders.find((f) => f.id === sourceParentId)?.name ??
        sourceParentId);
  const destFolderName =
    destParentId === "root" || !destParentId
      ? "Root"
      : (destFolders.find((f) => f.id === destParentId)?.name ?? destParentId);

  const autoName = useMemo(() => {
    if (!sourceAccount || !destAccount) return "Auto-sync: folder → folder";
    return direction === "two_way"
      ? `Auto-sync: ${sourceFolderName} ↔ ${destFolderName}`
      : `Auto-sync: ${sourceFolderName} → ${destFolderName}`;
  }, [direction, sourceAccount, destAccount, sourceFolderName, destFolderName]);

  const canCreate = Boolean(sourceAccountId && destAccountId) && !creating;

  const sourceFolderOptions = [
    { id: "root", label: "Root / default" },
    ...sourceFolders.map((f) => ({ id: f.id, label: f.name })),
  ];
  const destFolderOptions = [
    { id: "root", label: "Root / default" },
    ...destFolders.map((f) => ({ id: f.id, label: f.name })),
  ];

  async function submit() {
    if (!canCreate) return;
    await onCreate({
      sourceAccountId,
      destAccountId,
      sourceParentId: sourceParentId.trim() || "root",
      destParentId: destParentId.trim() || "root",
      direction,
      sourceLabel: name.trim() || autoName,
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
        aria-labelledby="new-sync-pair-title"
        className="relative z-10 flex max-h-[min(1040px,calc(100dvh-1.5rem))] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between bg-white px-4 py-2.5 text-foreground">
          <h2 id="new-sync-pair-title" className="text-base font-extrabold">
            New auto-sync pair
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted hover:bg-surface-secondary hover:text-foreground"
            aria-label="Close"
          >
            <Xmark className="h-4 w-4" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="min-h-0 space-y-4 overflow-y-auto px-4 py-3 sm:px-4">
            <ScheduleStep
              n={1}
              title="Sync direction"
              description="One-way mirrors the source into the destination. Two-way keeps both folders identical."
            >
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDirection("one_way")}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-bold transition-colors",
                    direction === "one_way"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-white text-foreground hover:bg-surface-secondary",
                  )}
                >
                  <ArrowRight className="h-4 w-4" />
                  One-way sync
                </button>
                <button
                  type="button"
                  onClick={() => setDirection("two_way")}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-bold transition-colors",
                    direction === "two_way"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-white text-foreground hover:bg-surface-secondary",
                  )}
                >
                  <ArrowsRotateRight className="h-4 w-4" />
                  Two-way sync
                </button>
              </div>
            </ScheduleStep>

            <ScheduleStep
              n={2}
              title="Source folder"
              description="Pick the folder whose changes will be mirrored."
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
                  onChange={(id) => {
                    setSourceAccountId(id);
                    setSourceParentId("");
                  }}
                />
                <PickerSelect
                  value={sourceAccountId ? sourceParentId || "root" : ""}
                  disabled={!sourceAccountId || sourceFoldersLoading}
                  placeholder={
                    !sourceAccountId
                      ? "Pick a source account first"
                      : sourceFoldersLoading
                        ? "Loading folders…"
                        : "Pick a source folder"
                  }
                  icon={<FolderOpen className="h-3.5 w-3.5" />}
                  options={sourceAccountId ? sourceFolderOptions : []}
                  onChange={(id) =>
                    setSourceParentId(id === "root" ? "root" : id)
                  }
                />
              </div>
            </ScheduleStep>

            <ScheduleStep
              n={3}
              title="Destination folder"
              description="Where mirrored items will land."
            >
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
                  onChange={(id) => {
                    setDestAccountId(id);
                    setDestParentId("");
                  }}
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
                  options={destAccountId ? destFolderOptions : []}
                  onChange={(id) =>
                    setDestParentId(id === "root" ? "root" : id)
                  }
                />
              </div>
            </ScheduleStep>

            <ScheduleStep
              n={4}
              title="Name & confirm"
              description="A friendly label for this pair. Leave blank to auto-derive."
            >
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={autoName}
                className="h-9 text-xs"
              />
              <p className="mt-1.5 text-[11px] text-muted">
                Leave blank to auto-derive:{" "}
                <span className="font-semibold text-foreground">
                  {autoName}
                </span>
              </p>
            </ScheduleStep>
          </div>

          <aside className="hidden min-h-0 border-l border-border bg-[#f7f9fa] lg:flex lg:flex-col">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Summary
              </p>

              <div>
                <p className="text-sm font-extrabold text-foreground">
                  {name.trim() || autoName}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <span className="rounded bg-primary px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-primary-foreground uppercase">
                    {direction === "two_way" ? "Two-way" : "One-way"}
                  </span>
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-primary uppercase">
                    Folder pair
                  </span>
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-border bg-white p-2.5 text-xs">
                <div>
                  <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
                    Source
                  </p>
                  <p className="mt-0.5 font-semibold text-foreground">
                    {sourceAccount ? accountLabel(sourceAccount) : "—"}
                  </p>
                  <p className="text-muted-foreground">
                    {sourceAccountId ? sourceFolderName : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
                    Destination
                  </p>
                  <p className="mt-0.5 font-semibold text-foreground">
                    {destAccount ? accountLabel(destAccount) : "—"}
                  </p>
                  <p className="text-muted-foreground">
                    {destAccountId ? destFolderName : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
                    Change detection
                  </p>
                  <p className="mt-0.5 text-muted-foreground">
                    {sourceAccountId && destAccountId
                      ? "Realtime when the provider supports it, with a backup poll every few minutes."
                      : "Pick the accounts to preview how changes are detected."}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-white p-2.5 text-[11px] leading-relaxed text-muted-foreground">
                The pair starts syncing as soon as it is created. Failed syncs
                surface only in the run history — review it regularly. There are
                no notifications.
              </div>
            </div>
          </aside>
        </div>

        <footer className="flex shrink-0 flex-col gap-2 bg-white px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CircleInfo className="h-3.5 w-3.5 shrink-0" />
            All set. Review the summary on the right.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onPress={onClose}
              isDisabled={creating}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              isDisabled={!canCreate}
              onPress={() => {
                void submit();
              }}
            >
              {creating ? "Creating…" : "Create sync pair"}
            </Button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
