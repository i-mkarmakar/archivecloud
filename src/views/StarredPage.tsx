"use client";

import { FileText, Star } from "@gravity-ui/icons";
import { useMemo } from "react";
import { MetricCard } from "@/components/drive/MetricCard";
import { PageHeader } from "@/components/drive/PageHeader";
import { WorkspaceFileList } from "@/components/drive/WorkspaceFileList";
import { useWorkspaceFiles } from "@/hooks/useWorkspaceFiles";

export function StarredPage() {
  const { files, loading, error } = useWorkspaceFiles("starred");

  const folderCount = useMemo(
    () => files.filter((file) => file.folderId).length,
    [files],
  );

  return (
    <>
      <PageHeader
        title="Starred"
        description="Pinned files for quick access."
      />
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Starred Files"
          value={String(files.length)}
          icon={Star}
        />
        <MetricCard
          label="In Folders"
          value={String(folderCount)}
          icon={FileText}
        />
        <MetricCard
          label="Home"
          value={String(files.filter((file) => !file.folderId).length)}
          icon={Star}
        />
      </div>
      {files.length > 0 ? (
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {files.slice(0, 3).map((file) => (
            <div key={file.id ?? file.name} className="p-1">
              <Star className="h-5 w-5 fill-warning text-muted" />
              <h2 className="mt-4 font-extrabold">{file.name}</h2>
              <p className="mt-1 text-sm text-muted">
                {file.starredDate
                  ? `Starred on ${file.starredDate}`
                  : "Starred file"}
              </p>
            </div>
          ))}
        </div>
      ) : null}
      <WorkspaceFileList
        files={files}
        loading={loading}
        error={error}
        mode="starred"
        storageKey="archivecloud:starred-view"
        emptyTitle="No starred files"
        emptyDescription="Star files from Home to pin them here."
      />
    </>
  );
}
