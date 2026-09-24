import { useState } from "react";
import type { FileItem } from "@/data/drive-data";

export function useFileSelection(displayFiles: FileItem[]) {
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(
    new Set(),
  );

  function toggleFileSelection(file: FileItem) {
    if (!file.id) return;
    setSelectedFileIds((current) => {
      const next = new Set(current);
      if (next.has(file.id!)) next.delete(file.id!);
      else next.add(file.id!);
      return next;
    });
  }

  function toggleAllVisibleFiles() {
    const visibleIds = displayFiles
      .map((file) => file.id)
      .filter(Boolean) as string[];
    const allSelected =
      visibleIds.length > 0 &&
      visibleIds.every((id) => selectedFileIds.has(id));
    setSelectedFileIds(allSelected ? new Set() : new Set(visibleIds));
  }

  function clearSelection() {
    setSelectedFileIds(new Set());
  }

  return {
    selectedFileIds,
    setSelectedFileIds,
    toggleFileSelection,
    toggleAllVisibleFiles,
    clearSelection,
  };
}
