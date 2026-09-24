import { toast } from "@heroui/react";
import { type Dispatch, type SetStateAction, useEffect } from "react";
import type { FileItem, FolderItem } from "@/data/drive-data";

type ContextMenuState = {
  x: number;
  y: number;
  file: FileItem | null;
};

type FolderContextMenuState = {
  x: number;
  y: number;
  folder: FolderItem | null;
};

type EmptyContextMenuState = {
  x: number;
  y: number;
  open: boolean;
};

export function useAllFilesShortcuts(args: {
  activeFolderForMenu: FolderItem | null;
  cutFolder: FolderItem | null;
  activeFolderId: string | null;
  cutSelectedFolder: (folder: FolderItem | null) => void;
  pasteFolder: () => Promise<void>;
  openMoveForFiles: (files: FileItem[]) => void;
  setContextMenu: Dispatch<SetStateAction<ContextMenuState>>;
  setFolderContextMenu: Dispatch<SetStateAction<FolderContextMenuState>>;
  setFolderDetailOpen: Dispatch<SetStateAction<boolean>>;
  setEmptyContextMenu: Dispatch<SetStateAction<EmptyContextMenuState>>;
  setActiveFile: Dispatch<SetStateAction<FileItem | null>>;
}) {
  const {
    activeFolderForMenu,
    cutFolder,
    activeFolderId,
    cutSelectedFolder,
    pasteFolder,
    openMoveForFiles,
    setContextMenu,
    setFolderContextMenu,
    setFolderDetailOpen,
    setEmptyContextMenu,
    setActiveFile,
  } = args;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setContextMenu({ x: 0, y: 0, file: null });
      if (event.key === "Escape")
        setFolderContextMenu({ x: 0, y: 0, folder: null });
      if (event.key === "Escape") setFolderDetailOpen(false);
      if (event.key === "Escape")
        setEmptyContextMenu({ x: 0, y: 0, open: false });
      if (
        event.ctrlKey &&
        event.key.toLowerCase() === "x" &&
        activeFolderForMenu
      ) {
        event.preventDefault();
        cutSelectedFolder(activeFolderForMenu);
      }
      if (event.ctrlKey && event.key.toLowerCase() === "v" && cutFolder) {
        event.preventDefault();
        pasteFolder().catch((error) =>
          toast.danger(
            error instanceof Error ? error.message : "Failed to paste folder",
          ),
        );
      }
    }

    function onOpenMoveShortcut(e: Event) {
      const file = (e as CustomEvent).detail as FileItem;
      setActiveFile(file);
      openMoveForFiles([file]);
    }

    window.addEventListener("keydown", onKey);
    window.addEventListener("archivecloud:open-move-modal", onOpenMoveShortcut);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(
        "archivecloud:open-move-modal",
        onOpenMoveShortcut,
      );
    };
  }, [activeFolderForMenu, cutFolder, activeFolderId]);
}
