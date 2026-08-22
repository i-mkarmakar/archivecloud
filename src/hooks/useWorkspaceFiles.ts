"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  type ApiFile,
  buildFilesQuery,
  type FileListView,
  mapApiFileToItem,
} from "@/lib/files";
import type { FileItem } from "@/data/drive-data";

export function useWorkspaceFiles(view: FileListView, limit?: number) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<{ files: ApiFile[] }>(
        buildFilesQuery(view, limit),
      );
      setFiles(data.files.map(mapApiFileToItem));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load files");
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [limit, view]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  return { files, loading, error, reload: load };
}

export async function updateFilesMetadata(
  fileIds: string[],
  patch: { isStarred?: boolean; isArchived?: boolean },
) {
  await apiFetch("/files/batch/metadata", {
    method: "PATCH",
    body: JSON.stringify({ fileIds, ...patch }),
  });
}

export async function trashFiles(fileIds: string[]) {
  await apiFetch("/files/batch", {
    method: "DELETE",
    body: JSON.stringify({ fileIds }),
  });
}
