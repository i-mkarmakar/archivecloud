"use client";

import { Clock, FileText } from "@gravity-ui/icons";
import { useMemo } from "react";
import { MetricCard } from "@/components/drive/MetricCard";
import { PageHeader } from "@/components/drive/PageHeader";
import { WorkspaceFileList } from "@/components/drive/WorkspaceFileList";
import { useWorkspaceFiles } from "@/hooks/useWorkspaceFiles";

export function RecentFilesPage() {
  const { files, loading, loadingMore, nextCursor, error, loadMore } =
    useWorkspaceFiles("recent", 40);

  const todayCount = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return files.filter((file) => {
      if (!file.lastAccessedAt) return false;
      return new Date(file.lastAccessedAt) >= start;
    }).length;
  }, [files]);

  return (
    <>
      <PageHeader
        title="Recent"
        description="Files you opened or downloaded recently."
      />
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Recent Files"
          value={String(files.length)}
          icon={Clock}
        />
        <MetricCard
          label="Opened Today"
          value={String(todayCount)}
          icon={FileText}
        />
        <MetricCard
          label="With Folders"
          value={String(files.filter((file) => file.folderId).length)}
          icon={Clock}
        />
      </div>
      <WorkspaceFileList
        files={files}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={Boolean(nextCursor)}
        error={error}
        mode="recent"
        storageKey="archivecloud:recent-view"
        emptyTitle="No recent files"
        emptyDescription="Preview or download files from Home to see them here."
        onLoadMore={() => {
          void loadMore();
        }}
      />
    </>
  );
}
