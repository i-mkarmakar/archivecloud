"use client";

import { FileTable } from "@/components/drive/FileTable";
import type { FileItem } from "@/data/drive-data";

export function WorkspaceFileList({
  files,
  loading,
  error,
  mode = "default",
  emptyTitle,
  emptyDescription,
}: {
  files: FileItem[];
  loading: boolean;
  error: string;
  mode?: "default" | "shared" | "starred" | "archived";
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (loading) {
    return (
      <div className="mt-6 flex min-h-[200px] items-center justify-center py-8">
        <p className="text-center text-sm text-muted">Loading files...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-6 flex min-h-[200px] items-center justify-center py-8">
        <p className="text-center text-sm text-danger-soft-foreground">
          {error}
        </p>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="mt-6 flex min-h-[200px] items-center justify-center py-8">
        <div className="text-center">
          <p className="font-extrabold">{emptyTitle}</p>
          <p className="mt-1 text-sm text-muted">{emptyDescription}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <FileTable files={files} mode={mode} />
    </div>
  );
}
