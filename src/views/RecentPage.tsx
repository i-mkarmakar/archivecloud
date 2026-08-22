"use client";

import { Card } from "@heroui/react";
import {
  ArrowDownToLine,
  Clock,
  Eye,
  Pencil,
} from "@gravity-ui/icons";
import { useEffect, useMemo, useState } from "react";
import { MetricCard } from "@/components/drive/MetricCard";
import { PageHeader } from "@/components/drive/PageHeader";
import { WorkspaceFileList } from "@/components/drive/WorkspaceFileList";
import { useWorkspaceFiles } from "@/hooks/useWorkspaceFiles";
import { apiFetch, formatDate } from "@/lib/api";

type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  metadata: string | Record<string, unknown> | null;
  createdAt: string;
};

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function parseMetadata(raw: AuditLog["metadata"]) {
  if (!raw) return {} as Record<string, unknown>;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function activityLabel(action: string, metadata: Record<string, unknown>) {
  const name =
    typeof metadata.name === "string" ? metadata.name : "a file";
  switch (action) {
    case "PREVIEW_FILE":
      return `Opened ${name}`;
    case "DOWNLOAD_FILE":
      return `Downloaded ${name}`;
    case "UPDATE_FILE":
      return `Updated ${name}`;
    case "UPLOAD_FILE":
      return `Uploaded ${name}`;
    case "TRASH_FILE":
      return `Moved ${name} to trash`;
    default:
      return action.replace(/_/g, " ");
  }
}

function activityIcon(action: string) {
  if (action === "PREVIEW_FILE") return Eye;
  if (action === "DOWNLOAD_FILE") return ArrowDownToLine;
  if (action === "UPDATE_FILE" || action === "UPLOAD_FILE") return Pencil;
  return Clock;
}

export function RecentPage() {
  const { files, loading, error } = useWorkspaceFiles("recent", 50);
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    apiFetch<{ logs: AuditLog[] }>("/audit-logs?limit=12")
      .then((data) => setLogs(data.logs))
      .catch(() => setLogs([]));
  }, []);

  const today = startOfToday();
  const openedToday = useMemo(
    () =>
      files.filter((file) => {
        if (!file.lastAccessedAt) return false;
        const parsed = new Date(file.lastAccessedAt);
        return !Number.isNaN(parsed.getTime()) && parsed >= today;
      }).length,
    [files, today],
  );

  const modifiedToday = useMemo(
    () =>
      files.filter((file) => {
        if (!file.updatedAt || !file.createdAt) return false;
        const updated = new Date(file.updatedAt);
        const created = new Date(file.createdAt);
        return updated >= today && updated.getTime() !== created.getTime();
      }).length,
    [files, today],
  );

  const downloadsToday = useMemo(
    () =>
      logs.filter(
        (log) =>
          log.action === "DOWNLOAD_FILE" &&
          new Date(log.createdAt) >= today,
      ).length,
    [logs, today],
  );

  const activities = logs
    .filter((log) =>
      ["PREVIEW_FILE", "DOWNLOAD_FILE", "UPDATE_FILE", "UPLOAD_FILE"].includes(
        log.action,
      ),
    )
    .slice(0, 6)
    .map((log) => {
      const metadata = parseMetadata(log.metadata);
      const Icon = activityIcon(log.action);
      return {
        id: log.id,
        text: activityLabel(log.action, metadata),
        time: formatDate(log.createdAt),
        icon: Icon,
      };
    });

  return (
    <>
      <PageHeader
        title="Recent"
        description="Latest opened and modified files."
      />
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard label="Opened Today" value={String(openedToday)} icon={Eye} />
        <MetricCard label="Modified" value={String(modifiedToday)} icon={Pencil} />
        <MetricCard
          label="Downloads"
          value={String(downloadsToday)}
          icon={ArrowDownToLine}
        />
      </div>
      {activities.length > 0 ? (
        <Card className="mt-6 p-5">
          <h2 className="font-extrabold">Activity</h2>
          <div className="mt-4 grid gap-3">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center gap-3 rounded-xl bg-background-secondary p-3"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-foreground shadow-sm">
                  <activity.icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{activity.text}</p>
                  <p className="text-sm text-muted">{activity.time}</p>
                </div>
                <Clock className="h-4 w-4 text-muted" />
              </div>
            ))}
          </div>
        </Card>
      ) : null}
      <WorkspaceFileList
        files={files}
        loading={loading}
        error={error}
        mode="recent"
        emptyTitle="No recent files yet"
        emptyDescription="Open or download files from All Files to see them here."
      />
    </>
  );
}
