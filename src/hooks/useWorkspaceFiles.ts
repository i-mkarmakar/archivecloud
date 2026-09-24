"use client";

import { useCallback, useEffect, useState } from "react";
import type { FileItem } from "@/data/drive-data";
import { apiFetch } from "@/lib/api";
import {
  type ApiFile,
  buildFilesQuery,
  type FileListView,
  mapApiFileToItem,
} from "@/lib/files";

const DEFAULT_PAGE_SIZE = 40;

export function useWorkspaceFiles(view: FileListView, limit = DEFAULT_PAGE_SIZE) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (cursor?: string | null) => {
      const isMore = Boolean(cursor);
      if (isMore) setLoadingMore(true);
      else {
        setLoading(true);
        setError("");
      }
      try {
        const data = await apiFetch<{
          files: ApiFile[];
          nextCursor: string | null;
        }>(buildFilesQuery(view, { limit, cursor }));
        const mapped = data.files.map(mapApiFileToItem);
        setFiles((prev) => (isMore ? [...prev, ...mapped] : mapped));
        setNextCursor(data.nextCursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load files");
        if (!isMore) setFiles([]);
        setNextCursor(null);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [limit, view],
  );

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const loadMore = useCallback(() => {
    if (!nextCursor || loadingMore) return;
    return load(nextCursor);
  }, [load, loadingMore, nextCursor]);

  return {
    files,
    loading,
    loadingMore,
    nextCursor,
    error,
    reload: () => load(),
    loadMore,
  };
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
