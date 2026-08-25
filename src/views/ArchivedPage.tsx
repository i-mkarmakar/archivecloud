"use client";

import { Archive, ArrowRotateLeft, TrashBin } from "@gravity-ui/icons";
import { Button, toast } from "@heroui/react";
import { useMemo, useState } from "react";
import { FileGrid } from "@/components/drive/FileGrid";
import { FileTable } from "@/components/drive/FileTable";
import { FileViewToggle } from "@/components/drive/FileViewToggle";
import { MetricCard } from "@/components/drive/MetricCard";
import {
  FileGridSkeleton,
  FileListSkeleton,
} from "@/components/drive/PageSkeletons";
import { PageHeader } from "@/components/drive/PageHeader";
import type { FileItem } from "@/data/drive-data";
import { useFileViewMode } from "@/hooks/useFileViewMode";
import {
  trashFiles,
  updateFilesMetadata,
  useWorkspaceFiles,
} from "@/hooks/useWorkspaceFiles";
import { formatBytes } from "@/lib/api";

export function ArchivedPage() {
  const { files, loading, error, reload } = useWorkspaceFiles("archived");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useFileViewMode("archivecloud:archived-view");
  const [pendingAction, setPendingAction] = useState<
    "restore" | "delete" | null
  >(null);
  const busy = pendingAction !== null;

  const totalBytes = useMemo(
    () => files.reduce((sum, file) => sum + Number(file.sizeBytes ?? 0), 0),
    [files],
  );

  const allSelected = files.length > 0 && selectedIds.size === files.length;

  function toggleFile(file: FileItem) {
    if (!file.id) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(file.id!)) next.delete(file.id!);
      else next.add(file.id!);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(files.map((file) => file.id!).filter(Boolean)));
  }

  async function restoreSelected() {
    const fileIds = [...selectedIds];
    if (fileIds.length === 0 || busy) return;
    setPendingAction("restore");
    try {
      await updateFilesMetadata(fileIds, { isArchived: false });
      setSelectedIds(new Set());
      toast.success(`Restored ${fileIds.length} file(s) to Home.`);
      await reload();
      window.dispatchEvent(new Event("archivecloud:storage-changed"));
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : "Restore failed.");
    } finally {
      setPendingAction(null);
    }
  }

  async function deleteSelected() {
    const fileIds = [...selectedIds];
    if (fileIds.length === 0 || busy) return;
    if (
      !confirm(
        `Move ${fileIds.length} archived file(s) to trash? They can be restored from Recycle Bin.`,
      )
    ) {
      return;
    }
    setPendingAction("delete");
    try {
      await trashFiles(fileIds);
      setSelectedIds(new Set());
      toast.success(`Moved ${fileIds.length} file(s) to trash.`);
      await reload();
      window.dispatchEvent(new Event("archivecloud:storage-changed"));
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Archived"
        description="Older files kept out of active workspace."
        actions={
          <>
            <Button
              variant="outline"
              onPress={restoreSelected}
              isDisabled={busy || selectedIds.size === 0}
              className={pendingAction === "delete" ? "opacity-50" : undefined}
            >
              <ArrowRotateLeft className="h-4 w-4" />
              {pendingAction === "restore" ? "Restoring..." : "Restore"}
            </Button>
            <Button
              variant="danger"
              onPress={deleteSelected}
              isDisabled={busy || selectedIds.size === 0}
              className={pendingAction === "restore" ? "opacity-50" : undefined}
            >
              <TrashBin className="h-4 w-4" />
              {pendingAction === "delete" ? "Moving..." : "Move to Trash"}
            </Button>
          </>
        }
      />
      <p className="mt-6 text-sm text-muted">
        Archived files stay available and do not appear in Home until restored.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label="Archived Files"
          value={String(files.length)}
          icon={Archive}
        />
        <MetricCard
          label="Storage Used"
          value={formatBytes(String(totalBytes))}
          icon={Archive}
        />
        <MetricCard
          label="Selected"
          value={String(selectedIds.size)}
          icon={ArrowRotateLeft}
        />
      </div>
      <div className="mt-6">
        <div className="mb-4 flex justify-end">
          <FileViewToggle mode={viewMode} onChange={setViewMode} />
        </div>
        {loading ? (
          viewMode === "grid" ? (
            <FileGridSkeleton />
          ) : (
            <FileListSkeleton />
          )
        ) : error ? (
          <div className="flex min-h-[200px] items-center justify-center py-8">
            <p className="text-center text-sm text-danger-soft-foreground">
              {error}
            </p>
          </div>
        ) : files.length === 0 ? (
          <div className="flex min-h-[200px] items-center justify-center py-8">
            <div className="text-center">
              <p className="font-extrabold">No archived files</p>
              <p className="mt-1 text-sm text-muted">
                Archive files from Home to hide them from your main workspace.
              </p>
            </div>
          </div>
        ) : viewMode === "grid" ? (
          <FileGrid
            files={files}
            selectedFileIds={selectedIds}
            sizeScale="sm"
            onToggleFile={toggleFile}
          />
        ) : (
          <FileTable
            files={files}
            mode="archived"
            selectedFileIds={selectedIds}
            allSelected={allSelected}
            onToggleFile={toggleFile}
            onToggleAll={toggleAll}
          />
        )}
      </div>
    </>
  );
}
