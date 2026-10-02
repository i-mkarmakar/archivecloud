"use client";

import { Clock, FileText } from "@gravity-ui/icons";
import { useEffect, useMemo, useState } from "react";
import {
  RecentNoAccountEmptyState,
  SharedNoAccountEmptyStateSkeleton,
} from "@/components/dashboard/SharedNoAccountEmptyState";
import { FileViewToggle } from "@/components/drive/FileViewToggle";
import { MetricCard } from "@/components/drive/MetricCard";
import { PageHeader } from "@/components/drive/PageHeader";
import { WorkspaceFileList } from "@/components/drive/WorkspaceFileList";
import { useFileViewMode } from "@/hooks/useFileViewMode";
import { useWorkspaceFiles } from "@/hooks/useWorkspaceFiles";
import { apiFetch } from "@/lib/api";

type ConnectedAccount = {
  id: string;
  status: string;
};

export function RecentFilesPage() {
  const { files, loading, loadingMore, nextCursor, error, loadMore } =
    useWorkspaceFiles("recent", 40);
  const [viewMode, setViewMode] = useFileViewMode("archivecloud:recent-view");
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [hasConnectedAccount, setHasConnectedAccount] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ accounts: ConnectedAccount[] }>("/connected-accounts")
      .then((data) => {
        if (cancelled) return;
        setHasConnectedAccount(
          data.accounts.some((account) => account.status === "connected"),
        );
      })
      .catch(() => {
        if (!cancelled) setHasConnectedAccount(false);
      })
      .finally(() => {
        if (!cancelled) setAccountsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const todayCount = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return files.filter((file) => {
      if (!file.lastAccessedAt) return false;
      return new Date(file.lastAccessedAt) >= start;
    }).length;
  }, [files]);

  const showNoAccountEmpty = accountsLoaded && !hasConnectedAccount;
  const showNoAccountSkeleton = !accountsLoaded;

  if (showNoAccountSkeleton) {
    return (
      <>
        <PageHeader
          title="Recent"
          actions={<FileViewToggle mode={viewMode} onChange={setViewMode} />}
        />
        <SharedNoAccountEmptyStateSkeleton />
      </>
    );
  }

  if (showNoAccountEmpty) {
    return (
      <>
        <PageHeader
          title="Recent"
          actions={<FileViewToggle mode={viewMode} onChange={setViewMode} />}
        />
        <RecentNoAccountEmptyState
          onConnected={() => setHasConnectedAccount(true)}
        />
      </>
    );
  }

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
        emptyImage="/blank/recents.png"
        onLoadMore={() => {
          void loadMore();
        }}
      />
    </>
  );
}
