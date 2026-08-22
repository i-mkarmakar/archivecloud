"use client";

import { useState } from "react";
import type { FileViewMode } from "@/components/drive/FileViewToggle";

export function useFileViewMode(
  storageKey: string,
  defaultMode: FileViewMode = "list",
) {
  const [mode, setMode] = useState<FileViewMode>(() => {
    if (typeof window === "undefined") return defaultMode;
    const stored = localStorage.getItem(storageKey);
    return stored === "grid" || stored === "list" || stored === "calendar"
      ? stored
      : defaultMode;
  });

  function changeMode(next: FileViewMode) {
    setMode(next);
    localStorage.setItem(storageKey, next);
  }

  return [mode, changeMode] as const;
}
