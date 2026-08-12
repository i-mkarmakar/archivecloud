"use client";

import { Card } from "@heroui/react";
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
  mode?: "default" | "shared" | "recent" | "starred" | "archived";
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (loading) {
    return (
      <Card className="mt-6 p-6 text-sm text-muted">Loading files...</Card>
    );
  }

  if (error) {
    return (
      <Card className="mt-6 p-6 text-sm text-danger-soft-foreground">
        {error}
      </Card>
    );
  }

  if (files.length === 0) {
    return (
      <Card className="mt-6 p-8 text-center">
        <p className="font-extrabold">{emptyTitle}</p>
        <p className="mt-1 text-sm text-muted">{emptyDescription}</p>
      </Card>
    );
  }

  return <FileTable files={files} mode={mode} />;
}
