import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useEffect,
} from "react";
import type { FileItem } from "@/data/drive-data";
import { API_URL, apiFetch } from "@/lib/api";
import { createPlyr, ensurePlyr } from "@/lib/plyr";
import { isLinkedFileId } from "@/views/all-files/linked-ids";

export function useFilePreview(args: {
  previewOpen: boolean;
  activeFile: FileItem | null;
  previewUrl: string;
  previewVideoRef: RefObject<HTMLVideoElement | null>;
  setActiveFile: Dispatch<SetStateAction<FileItem | null>>;
  setPreviewUrl: Dispatch<SetStateAction<string>>;
  setPreviewError: Dispatch<SetStateAction<string>>;
  setPreviewLoading: Dispatch<SetStateAction<boolean>>;
  setPreviewOpen: Dispatch<SetStateAction<boolean>>;
  setContextMenu: Dispatch<
    SetStateAction<{ x: number; y: number; file: FileItem | null }>
  >;
}) {
  const {
    previewOpen,
    activeFile,
    previewUrl,
    previewVideoRef,
    setActiveFile,
    setPreviewUrl,
    setPreviewError,
    setPreviewLoading,
    setPreviewOpen,
    setContextMenu,
  } = args;

  useEffect(() => {
    if (
      !previewOpen ||
      !activeFile?.mimeType?.startsWith("video/") ||
      !previewVideoRef.current
    )
      return undefined;
    let disposed = false;
    let player: { destroy: () => void } | null = null;

    ensurePlyr()
      .then(() => {
        if (disposed || !previewVideoRef.current) return;
        player = createPlyr(previewVideoRef.current);
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      player?.destroy();
    };
  }, [previewOpen, activeFile?.mimeType, previewUrl]);

  async function openFilePreview(file: FileItem) {
    if (!file.id) return;
    setActiveFile(file);
    setPreviewUrl("");
    setPreviewError("");
    setPreviewLoading(true);
    setPreviewOpen(true);
    setContextMenu({ x: 0, y: 0, file: null });
    try {
      if (isLinkedFileId(file.id)) {
        const accountId = file.connectedAccountId;
        const providerFileId = file.providerFileId;
        if (!accountId || !providerFileId) {
          throw new Error("Linked file is missing account details.");
        }
        setPreviewUrl(
          `${API_URL}/connected-accounts/${accountId}/files/${encodeURIComponent(providerFileId)}/preview`,
        );
        return;
      }

      const data = await apiFetch<{ path?: string; url: string }>(
        `/files/${file.id}/preview-token`,
        { method: "POST" },
      );
      const previewPath = data.path ?? new URL(data.url).pathname;
      setPreviewUrl(`${API_URL}${previewPath}`);
    } catch (error) {
      setPreviewError(
        error instanceof Error ? error.message : "Failed to load preview",
      );
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreview() {
    setPreviewUrl("");
    setPreviewError("");
    setPreviewLoading(false);
    setPreviewOpen(false);
  }

  return { openFilePreview, closePreview };
}
