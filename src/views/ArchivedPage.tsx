"use client";

import { Button, Card, toast } from "@heroui/react";
import { Archive, ArrowRotateLeft, TrashBin } from "@gravity-ui/icons";
import { useMemo, useState } from "react";
import { FileTable } from "@/components/drive/FileTable";
import { MetricCard } from "@/components/drive/MetricCard";
import { PageHeader } from "@/components/drive/PageHeader";
import {
  trashFiles,
  updateFilesMetadata,
  useWorkspaceFiles,
} from "@/hooks/useWorkspaceFiles";
import { formatBytes } from "@/lib/api";
import type { FileItem } from "@/data/drive-data";

export function ArchivedPage() {
  const { files, loading, error, reload } = useWorkspaceFiles("archived");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const totalBytes = useMemo(
    () =>
      files.reduce((sum, file) => sum + Number(file.sizeBytes ?? 0), 0),
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
    if (fileIds.length === 0) return;
    setBusy(true);
    try {
      await updateFilesMetadata(fileIds, { isArchived: false });
      setSelectedIds(new Set());
      toast.success(`Restored ${fileIds.length} file(s) to All Files.`);
      await reload();
      window.dispatchEvent(new Event("archivecloud:storage-changed"));
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : "Restore failed.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelected() {
    const fileIds = [...selectedIds];
    if (fileIds.length === 0) return;
    if (
      !confirm(
        `Move ${fileIds.length} archived file(s) to trash? They can be restored from Recycle Bin.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await trashFiles(fileIds);
      setSelectedIds(new Set());
      toast.success(`Moved ${fileIds.length} file(s) to trash.`);
      await reload();
      window.dispatchEvent(new Event("archivecloud:storage-changed"));
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setBusy(false);
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
            >
              <ArrowRotateLeft className="h-4 w-4" />
              Restore
            </Button>
            <Button
              variant="danger"
              onPress={deleteSelected}
              isDisabled={busy || selectedIds.size === 0}
            >
              <TrashBin className="h-4 w-4" />
              Move to Trash
            </Button>
          </>
        }
      />
      <Card className="mt-6 border-border bg-surface-secondary p-4 text-sm text-foreground">
        Archived files stay available and do not appear in All Files until
        restored.
      </Card>
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
      {loading ? (
        <Card className="mt-6 p-6 text-sm text-muted">Loading files...</Card>
      ) : error ? (
        <Card className="mt-6 p-6 text-sm text-danger-soft-foreground">
          {error}
        </Card>
      ) : files.length === 0 ? (
        <Card className="mt-6 p-8 text-center">
          <p className="font-extrabold">No archived files</p>
          <p className="mt-1 text-sm text-muted">
            Archive files from All Files to hide them from your main workspace.
          </p>
        </Card>
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
    </>
  );
}
