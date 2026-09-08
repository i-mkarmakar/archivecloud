"use client";

import { ArrowRotateRight, Timeline } from "@gravity-ui/icons";
import { Button, Card } from "@heroui/react";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/drive/PageHeader";
import { CardListSkeleton } from "@/components/drive/PageSkeletons";
import { apiFetch, formatDate } from "@/lib/api";

type AuditLog = {
  id: string;
  action: string;
  actionLabel: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: string;
};

function metadataSummary(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const obj = metadata as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of [
    "name",
    "fileName",
    "jobId",
    "scheduleKind",
    "sizeBytes",
    "via",
  ]) {
    const value = obj[key];
    if (value == null) continue;
    parts.push(`${key}: ${String(value)}`);
  }
  if (parts.length === 0) return null;
  return parts.slice(0, 3).join(" · ");
}

export function ActivityPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (cursor?: string | null) => {
    const isMore = Boolean(cursor);
    if (isMore) setLoadingMore(true);
    else {
      setLoading(true);
      setError("");
    }
    try {
      const qs = new URLSearchParams({ limit: "40" });
      if (cursor) qs.set("cursor", cursor);
      const res = await apiFetch<{
        logs: AuditLog[];
        nextCursor: string | null;
      }>(`/audit?${qs.toString()}`);
      setLogs((prev) => (isMore ? [...prev, ...res.logs] : res.logs));
      setNextCursor(res.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  return (
    <>
      <PageHeader
        title="Activity"
        description="Recent actions across uploads, transfers, sync, and sharing."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => load().catch(() => undefined)}
          >
            <ArrowRotateRight className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <Card className="mt-6 p-5">
        {loading ? (
          <CardListSkeleton count={6} label="Loading activity" />
        ) : null}
        {error ? (
          <p className="text-sm text-danger-soft-foreground">{error}</p>
        ) : null}
        {!loading && !error && logs.length === 0 ? (
          <div className="flex flex-col items-start gap-2">
            <Timeline className="h-5 w-5 text-muted" />
            <p className="text-sm text-muted">
              No activity yet. Uploads, transfers, and sync runs will show up
              here.
            </p>
          </div>
        ) : null}

        <div className="grid gap-3">
          {logs.map((log) => {
            const summary = metadataSummary(log.metadata);
            return (
              <div
                key={log.id}
                className="rounded-2xl border border-border bg-surface-secondary px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-extrabold">{log.actionLabel}</p>
                    <p className="mt-1 text-xs text-muted">
                      {log.entityType}
                      {log.entityId ? ` · ${log.entityId.slice(0, 8)}…` : ""}
                    </p>
                    {summary ? (
                      <p className="mt-1 truncate text-xs text-muted">
                        {summary}
                      </p>
                    ) : null}
                  </div>
                  <p className="shrink-0 text-xs text-muted">
                    {formatDate(log.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {nextCursor ? (
          <Button
            className="mt-4"
            variant="outline"
            size="sm"
            isDisabled={loadingMore}
            onClick={() => load(nextCursor).catch(() => undefined)}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        ) : null}
      </Card>
    </>
  );
}
