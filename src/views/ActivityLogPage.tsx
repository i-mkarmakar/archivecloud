import { Card } from "@heroui/react";
import {
  ArrowDownToLine,
  ArrowRotateRight,
  Clock,
  ClockArrowRotateLeft,
  FileText,
  Folder,
  FolderArrowRight,
  Plus,
  TrashBin,
  TriangleExclamation,
} from "@gravity-ui/icons";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/drive/PageHeader";
import { apiFetch, formatDate } from "@/lib/api";
import { cn } from "@/lib/utils";

type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: string | any | null;
  createdAt: string;
};

export function ActivityLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadLogs() {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<{ logs: AuditLog[] }>("/audit-logs");
      setLogs(data.logs);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load activity logs",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs().catch(() => undefined);
  }, []);

  function getActionBadge(action: string) {
    const act = action.toUpperCase();
    if (act.includes("CREATE") || act.includes("UPLOAD")) {
      return {
        bg: "bg-success-soft text-success-soft-foreground border-success-soft",
        icon: Plus,
        label: action.replace(/_/g, " "),
      };
    }
    if (
      act.includes("DELETE") ||
      act.includes("PERMANENT") ||
      act.includes("TRASH")
    ) {
      return {
        bg: "bg-danger-soft text-danger-soft-foreground border-danger-soft",
        icon: TrashBin,
        label: action.replace(/_/g, " "),
      };
    }
    if (act.includes("RESTORE") || act.includes("SYNC")) {
      return {
        bg: "bg-success-soft text-success-soft-foreground border-success-soft",
        icon: ArrowRotateRight,
        label: action.replace(/_/g, " "),
      };
    }
    if (act.includes("MOVE")) {
      return {
        bg: "bg-accent-soft text-accent-soft-foreground border-accent-soft",
        icon: FolderArrowRight,
        label: action.replace(/_/g, " "),
      };
    }
    if (act.includes("DOWNLOAD")) {
      return {
        bg: "bg-accent-soft text-accent-soft-foreground border-accent-soft",
        icon: ArrowDownToLine,
        label: action.replace(/_/g, " "),
      };
    }
    return {
      bg: "bg-default-soft text-default-soft-foreground border-default-soft",
      icon: ClockArrowRotateLeft,
      label: action.replace(/_/g, " "),
    };
  }

  function renderMetadata(metadata: any) {
    if (!metadata) return null;
    let parsed = metadata;
    if (typeof metadata === "string") {
      try {
        parsed = JSON.parse(metadata);
      } catch {
        return <span className="text-muted">{metadata}</span>;
      }
    }

    if (typeof parsed !== "object") {
      return <span className="text-muted">{String(parsed)}</span>;
    }

    // Special metadata keys rendering
    const parts: string[] = [];
    if (parsed.name) parts.push(`Name: ${parsed.name}`);
    if (parsed.fileName) parts.push(`File: ${parsed.fileName}`);
    if (parsed.folderName) parts.push(`Folder: ${parsed.folderName}`);
    if (parsed.count !== undefined) parts.push(`Count: ${parsed.count}`);
    if (parsed.sizeBytes !== undefined) {
      const bytes = Number(parsed.sizeBytes);
      parts.push(`Size: ${formatBytes(bytes)}`);
    }

    if (parts.length > 0) {
      return (
        <span className="text-xs text-muted font-medium">
          {parts.join(" | ")}
        </span>
      );
    }

    return (
      <span className="text-xs text-muted font-mono">
        {JSON.stringify(parsed)}
      </span>
    );
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
  }

  return (
    <>
      <PageHeader
        title="Activity Log"
        description="View audit trails and file activities in your ArchiveCloud workspace."
      />

      {error && (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-danger-soft bg-danger-soft p-4 text-danger-soft-foreground">
          <TriangleExclamation className="h-5 w-5 shrink-0" />
          <p className="text-sm font-semibold">{error}</p>
        </div>
      )}

      <Card className="mt-8 overflow-hidden border border-border bg-surface shadow-overlay shadow-surface">
        <div className="border-b border-separator bg-background-secondary/50 px-6 py-4">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <ClockArrowRotateLeft className="h-5 w-5 text-muted" />
            Recent Activity Trail
          </h2>
        </div>

        <div className="divide-y divide-separator">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted">
              <ArrowRotateRight className="h-8 w-8 animate-spin text-foreground mb-2" />
              <p className="text-sm">Loading activity logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted">
              <ClockArrowRotateLeft className="h-12 w-12 stroke-[1.5] mb-3 text-muted" />
              <p className="font-semibold text-muted">No activity yet</p>
              <p className="text-sm text-muted mt-1">
                Actions you perform on your folders and files will appear here.
              </p>
            </div>
          ) : (
            logs.map((log) => {
              const badge = getActionBadge(log.action);
              const EntityIcon =
                log.entityType === "folder" ? Folder : FileText;

              return (
                <div
                  key={log.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 hover:bg-background-secondary transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-xl border font-bold shrink-0",
                        badge.bg,
                      )}
                    >
                      <badge.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-foreground uppercase tracking-wider text-[11px] px-2 py-0.5 rounded-full border border-border bg-background-secondary">
                          {badge.label}
                        </span>
                        <div className="flex items-center gap-1.5 text-xs text-muted">
                          <EntityIcon className="h-3.5 w-3.5" />
                          <span>{log.entityType}</span>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-col gap-0.5">
                        {renderMetadata(log.metadata)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted self-end sm:self-center">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{formatDate(log.createdAt)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </>
  );
}
