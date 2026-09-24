"use client";

import { Button } from "@heroui/react";
import type { MouseEvent } from "react";
import { FileGrid } from "@/components/drive/FileGrid";
import { FileTable } from "@/components/drive/FileTable";
import { FileViewToggle } from "@/components/drive/FileViewToggle";
import {
  FileGridSkeleton,
  FileListSkeleton,
} from "@/components/drive/PageSkeletons";
import type { FileItem } from "@/data/drive-data";
import { useFileViewMode } from "@/hooks/useFileViewMode";

export function WorkspaceFileList({
  files,
  loading,
  loadingMore = false,
  hasMore = false,
  error,
  mode = "default",
  storageKey = "archivecloud:workspace-view",
  emptyTitle,
  emptyDescription,
  selectedFileIds,
  allSelected,
  onToggleFile,
  onToggleAll,
  onFileContextMenu,
  onLoadMore,
}: {
  files: FileItem[];
  loading: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  error: string;
  mode?: "default" | "shared" | "starred" | "archived" | "recent";
  storageKey?: string;
  emptyTitle: string;
  emptyDescription: string;
  selectedFileIds?: Set<string>;
  allSelected?: boolean;
  onToggleFile?: (file: FileItem) => void;
  onToggleAll?: () => void;
  onFileContextMenu?: (event: MouseEvent<HTMLElement>, file: FileItem) => void;
  onLoadMore?: () => void;
}) {
  const [viewMode, setViewMode] = useFileViewMode(storageKey);

  return (
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
            <p className="font-extrabold">{emptyTitle}</p>
            <p className="mt-1 text-sm text-muted">{emptyDescription}</p>
          </div>
        </div>
      ) : viewMode === "grid" ? (
        <FileGrid
          files={files}
          selectedFileIds={selectedFileIds}
          sizeScale="sm"
          onToggleFile={onToggleFile}
          onFileContextMenu={onFileContextMenu}
        />
      ) : (
        <FileTable
          files={files}
          mode={mode}
          selectedFileIds={selectedFileIds}
          allSelected={allSelected}
          onToggleFile={onToggleFile}
          onToggleAll={onToggleAll}
          onFileContextMenu={onFileContextMenu}
        />
      )}

      {hasMore && onLoadMore ? (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            isDisabled={loadingMore}
            onPress={() => onLoadMore()}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
