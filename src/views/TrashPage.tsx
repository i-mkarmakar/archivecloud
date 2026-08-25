"use client";

import { ArrowRotateLeft, FileText, TrashBin } from "@gravity-ui/icons";
import { Button, toast } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { FileGrid } from "@/components/drive/FileGrid";
import { FileViewToggle } from "@/components/drive/FileViewToggle";
import {
  FileGridSkeleton,
  FileListSkeleton,
} from "@/components/drive/PageSkeletons";
import { PageHeader } from "@/components/drive/PageHeader";
import type { FileItem } from "@/data/drive-data";
import { useFileViewMode } from "@/hooks/useFileViewMode";
import { apiFetch, formatBytes, formatDate } from "@/lib/api";
import { mimeToKind } from "@/lib/files";

type TrashFile = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: string;
  provider: string;
  deletedAt: string;
  connectedAccount: {
    email: string;
    provider: string;
  };
};

function mapTrashFile(file: TrashFile): FileItem {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    date: formatDate(file.deletedAt),
    size: formatBytes(file.sizeBytes),
    access: file.connectedAccount.email,
    accountEmail: file.connectedAccount.email,
    accountProvider: "Google Drive",
    kind: mimeToKind(file.mimeType, file.name),
    shared: 1,
    createdAt: file.deletedAt,
    updatedAt: file.deletedAt,
    thumbnailUrl: `/files/${file.id}/thumbnail`,
  };
}

export function TrashPage() {
  const [files, setFiles] = useState<TrashFile[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useFileViewMode("archivecloud:trash-view");
  const [listLoading, setListLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    "restore" | "delete" | null
  >(null);
  const [pendingFileId, setPendingFileId] = useState<string | null>(null);
  const busy = pendingAction !== null;
  const gridFiles = useMemo(() => files.map(mapTrashFile), [files]);

  async function loadTrash() {
    setListLoading(true);
    try {
      const data = await apiFetch<{ files: TrashFile[] }>("/files/trash");
      setFiles(data.files);
    } catch (error) {
      toast.danger(
        error instanceof Error ? error.message : "Failed to load trash",
      );
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    loadTrash().catch(() => undefined);
  }, []);

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  function toggleSelectAll() {
    if (selectedIds.size === files.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(files.map((f) => f.id)));
    }
  }

  function toggleGridFile(file: FileItem) {
    if (!file.id) return;
    toggleSelect(file.id);
  }

  async function handleRestore(ids: string[]) {
    if (ids.length === 0 || busy) return;
    setPendingAction("restore");
    setPendingFileId(ids.length === 1 ? ids[0]! : null);
    try {
      await apiFetch("/files/batch/restore", {
        method: "POST",
        body: JSON.stringify({ fileIds: ids }),
      });
      setFiles((prev) => prev.filter((f) => !ids.includes(f.id)));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      toast.success(`Successfully restored ${ids.length} file(s).`);
      window.dispatchEvent(new Event("archivecloud:storage-changed"));
    } catch (error) {
      toast.danger(
        error instanceof Error ? error.message : "Failed to restore files",
      );
    } finally {
      setPendingAction(null);
      setPendingFileId(null);
    }
  }

  async function handlePermanentDelete(ids: string[]) {
    if (ids.length === 0 || busy) return;
    if (
      !confirm(
        `Are you sure you want to permanently delete ${ids.length} file(s)? This action cannot be undone.`,
      )
    )
      return;
    setPendingAction("delete");
    setPendingFileId(ids.length === 1 ? ids[0]! : null);
    try {
      await apiFetch("/files/batch/permanent", {
        method: "DELETE",
        body: JSON.stringify({ fileIds: ids }),
      });
      setFiles((prev) => prev.filter((f) => !ids.includes(f.id)));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      toast.success(`Permanently deleted ${ids.length} file(s).`);
      window.dispatchEvent(new Event("archivecloud:storage-changed"));
    } catch (error) {
      toast.danger(
        error instanceof Error
          ? error.message
          : "Failed to permanently delete files",
      );
    } finally {
      setPendingAction(null);
      setPendingFileId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Recycle Bin"
        description="Manage deleted files. Restore them to active folders or delete them permanently."
        actions={
          selectedIds.size > 0 ? (
            <>
              <Button
                variant="outline"
                onClick={() => handleRestore(Array.from(selectedIds))}
                isDisabled={busy}
                className={
                  pendingAction === "delete" ? "opacity-50" : undefined
                }
              >
                <ArrowRotateLeft className="h-4 w-4" />{" "}
                {pendingAction === "restore" && !pendingFileId
                  ? "Restoring..."
                  : `Restore Selected (${selectedIds.size})`}
              </Button>
              <Button
                variant="danger"
                onClick={() => handlePermanentDelete(Array.from(selectedIds))}
                isDisabled={busy}
                className={
                  pendingAction === "restore" ? "opacity-50" : undefined
                }
              >
                <TrashBin className="h-4 w-4" />{" "}
                {pendingAction === "delete" && !pendingFileId
                  ? "Deleting..."
                  : `Delete Selected (${selectedIds.size})`}
              </Button>
            </>
          ) : null
        }
      />

      <section className="mt-8">
        <div className="mb-4 flex justify-end">
          <FileViewToggle mode={viewMode} onChange={setViewMode} />
        </div>
        {listLoading ? (
          viewMode === "grid" ? (
            <FileGridSkeleton />
          ) : (
            <FileListSkeleton />
          )
        ) : files.length === 0 ? (
          <div className="flex min-h-[200px] items-center justify-center py-8">
            <div className="text-center">
              <p className="font-extrabold">Trash is empty</p>
              <p className="mt-1 text-sm text-muted">
                Deleted files will appear here.
              </p>
            </div>
          </div>
        ) : viewMode === "grid" ? (
          <FileGrid
            files={gridFiles}
            selectedFileIds={selectedIds}
            sizeScale="sm"
            onToggleFile={toggleGridFile}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border text-sm font-semibold text-muted">
                  <th className="w-12 p-4">
                    <input
                      type="checkbox"
                      checked={
                        selectedIds.size === files.length && files.length > 0
                      }
                      onChange={toggleSelectAll}
                      className="rounded border-border"
                    />
                  </th>
                  <th className="p-4">Name</th>
                  <th className="p-4">Account</th>
                  <th className="p-4">Size</th>
                  <th className="p-4">Deleted At</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr
                    key={file.id}
                    className="border-b border-separator transition hover:bg-background-secondary/50"
                  >
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(file.id)}
                        onChange={() => toggleSelect(file.id)}
                        className="rounded border-border"
                      />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 shrink-0 text-muted" />
                        <span
                          className="block max-w-xs truncate font-medium sm:max-w-md"
                          title={file.name}
                        >
                          {file.name}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-muted">
                      {file.connectedAccount.email} ({file.provider})
                    </td>
                    <td className="p-4 text-sm font-semibold">
                      {formatBytes(file.sizeBytes)}
                    </td>
                    <td className="p-4 text-sm text-muted">
                      {new Intl.DateTimeFormat("en", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(file.deletedAt))}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRestore([file.id])}
                          isDisabled={busy}
                          className={
                            pendingFileId === file.id &&
                            pendingAction === "delete"
                              ? "opacity-50"
                              : undefined
                          }
                          aria-label="Restore"
                        >
                          <ArrowRotateLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handlePermanentDelete([file.id])}
                          isDisabled={busy}
                          className={
                            pendingFileId === file.id &&
                            pendingAction === "restore"
                              ? "opacity-50"
                              : undefined
                          }
                          aria-label="Delete Permanently"
                        >
                          <TrashBin className="h-4 w-4 text-danger" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
