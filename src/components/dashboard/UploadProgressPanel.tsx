"use client";

import { Button, Card, ProgressBar } from "@heroui/react";
import {
  ArrowUpFromLine,
  ChevronDown,
  CircleCheck,
  Xmark,
} from "@gravity-ui/icons";
import type { UploadProgressState } from "@/context/UploadContext";
import { formatBytes } from "@/lib/api";
import { cn } from "@/lib/utils";

export function UploadProgressPanel({
  uploadProgress,
  collapsed,
  onToggleCollapsed,
  onClose,
  onRetry,
}: {
  uploadProgress: UploadProgressState;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onClose: () => void;
  onRetry: (fileName: string) => void;
}) {
  if (!uploadProgress.open) return null;

  const statusLabel =
    uploadProgress.status === "done"
      ? "Upload complete"
      : uploadProgress.status === "partial"
        ? "Upload completed with errors"
        : uploadProgress.status === "error"
          ? "Upload failed"
          : uploadProgress.percent >= 99
            ? "Processing on server"
            : "Uploading files";

  const statusIcon =
    uploadProgress.status === "done" ? (
      <CircleCheck className="h-5 w-5 text-success" />
    ) : uploadProgress.status === "partial" ||
      uploadProgress.status === "error" ? (
      <Xmark className="h-5 w-5 text-danger" />
    ) : (
      <ArrowUpFromLine className="h-5 w-5 text-foreground" />
    );

  const barColor =
    uploadProgress.status === "error" || uploadProgress.status === "partial"
      ? "danger"
      : uploadProgress.status === "done"
        ? "success"
        : "accent";

  return (
    <Card className="fixed inset-x-3 bottom-3 z-[70] max-h-[70dvh] overflow-hidden border border-border shadow-overlay sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[min(420px,calc(100vw-2.5rem))]">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-extrabold text-foreground">
          {statusIcon}
          {statusLabel}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            isIconOnly
            size="sm"
            onPress={onToggleCollapsed}
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                collapsed && "rotate-180",
              )}
            />
          </Button>
          <Button variant="ghost" isIconOnly size="sm" onPress={onClose}>
            <Xmark className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!collapsed && (
        <Card.Content className="p-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <p className="truncate font-semibold">{uploadProgress.fileName}</p>
            <span className="text-muted">{uploadProgress.percent}%</span>
          </div>
          <ProgressBar
            aria-label="Upload progress"
            value={uploadProgress.percent}
            color={barColor}
            className="mt-3"
          >
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>

          {uploadProgress.files.length > 0 ? (
            <div className="mt-4 grid max-h-64 gap-3 overflow-y-auto pr-1">
              {uploadProgress.files.map((file) => (
                <Card
                  key={`${file.name}-${file.size}`}
                  variant="secondary"
                  className="p-3"
                >
                  <div className="flex min-w-0 items-center justify-between gap-3 text-sm">
                    <p
                      className="min-w-0 flex-1 truncate font-semibold"
                      title={file.name}
                    >
                      {file.name}
                    </p>
                    <span className="shrink-0 text-xs text-muted">
                      {file.percent}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs text-muted">
                    <span>{formatBytes(file.size)}</span>
                    <div className="flex items-center gap-2">
                      {file.status === "error" && (
                        <Button
                          variant="primary"
                          size="sm"
                          className="h-6 px-2 text-[11px] font-extrabold"
                          onPress={() => onRetry(file.name)}
                        >
                          Retry
                        </Button>
                      )}
                      <span
                        className={
                          file.status === "error"
                            ? "font-semibold text-danger"
                            : file.status === "done"
                              ? "font-semibold text-muted"
                              : "font-semibold text-foreground"
                        }
                      >
                        {file.status === "error"
                          ? "Failed"
                          : file.status === "done"
                            ? "Done"
                            : file.percent >= 99
                              ? "Processing"
                              : "Uploading"}
                      </span>
                    </div>
                  </div>
                  <ProgressBar
                    aria-label={`${file.name} upload progress`}
                    value={file.percent}
                    color={
                      file.status === "error"
                        ? "danger"
                        : file.status === "done"
                          ? "success"
                          : "accent"
                    }
                    size="sm"
                    className="mt-2"
                  >
                    <ProgressBar.Track>
                      <ProgressBar.Fill />
                    </ProgressBar.Track>
                  </ProgressBar>
                </Card>
              ))}
            </div>
          ) : null}
        </Card.Content>
      )}
    </Card>
  );
}
