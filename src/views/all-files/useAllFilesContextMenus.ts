import {
  type Dispatch,
  type MouseEvent,
  type SetStateAction,
  useState,
} from "react";
import type { FileItem, FolderItem } from "@/data/drive-data";

export function useAllFilesContextMenus(
  setActiveFile: Dispatch<SetStateAction<FileItem | null>>,
  setActiveFolderForMenu: Dispatch<SetStateAction<FolderItem | null>>,
) {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    file: FileItem | null;
  }>({ x: 0, y: 0, file: null });
  const [folderContextMenu, setFolderContextMenu] = useState<{
    x: number;
    y: number;
    folder: FolderItem | null;
  }>({ x: 0, y: 0, folder: null });
  const [emptyContextMenu, setEmptyContextMenu] = useState<{
    x: number;
    y: number;
    open: boolean;
  }>({ x: 0, y: 0, open: false });

  function openContext(event: MouseEvent<HTMLElement>, file: FileItem) {
    event.preventDefault();
    event.stopPropagation();
    setActiveFile(file);
    setContextMenu({ x: event.clientX, y: event.clientY, file });
  }

  function openFolderMenu(event: MouseEvent<HTMLElement>, folder: FolderItem) {
    event.preventDefault();
    event.stopPropagation();
    setActiveFolderForMenu(folder);
    if (event.type === "contextmenu") {
      setFolderContextMenu({ x: event.clientX, y: event.clientY, folder });
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    setFolderContextMenu({
      x: Math.max(12, rect.right - 224),
      y: rect.bottom + 4,
      folder,
    });
  }

  function openEmptyContextMenu(event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    setEmptyContextMenu({ x: event.clientX, y: event.clientY, open: true });
  }

  return {
    contextMenu,
    setContextMenu,
    folderContextMenu,
    setFolderContextMenu,
    emptyContextMenu,
    setEmptyContextMenu,
    openContext,
    openFolderMenu,
    openEmptyContextMenu,
  };
}
