"use client";

import { EllipsisVertical } from "@gravity-ui/icons";
import type { MouseEvent } from "react";
import { Folder } from "@/components/folder/Folder";
import { normalizeFolderColor } from "@/components/drive/folder-colors";
import type { FolderItem } from "@/data/drive-data";
import { cn } from "@/lib/utils";

export type FolderSizeScale = "xs" | "sm" | "md" | "lg";

function folderColorToTheme(color?: string | null): "black" | "white" | "blue" {
  const hex = normalizeFolderColor(color).toLowerCase();
  if (hex === "#ffffff" || hex === "#f5f5f5" || hex === "#cbd5e1") {
    return "white";
  }
  if (
    hex === "#1e9df1" ||
    hex === "#50b1fd" ||
    hex === "#6366f1" ||
    hex === "#22c55e"
  ) {
    return "blue";
  }
  return "black";
}

const scaleConfig: Record<
  FolderSizeScale,
  {
    grid: string;
    item: string;
    folderSlot: string;
    folderScale: string;
    folderSize: "sm" | "md" | "lg";
    title: string;
    sub: string;
  }
> = {
  xs: {
    grid: "grid-cols-3 sm:grid-cols-4 xl:grid-cols-6 gap-x-0 gap-y-2",
    item: "min-h-28 p-2.5",
    folderSlot: "h-20 w-full",
    folderScale: "scale-[0.26]",
    folderSize: "sm",
    title: "text-[11px] mt-2",
    sub: "text-[10px] mt-0.5",
  },
  sm: {
    grid: "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-x-0 gap-y-3",
    item: "min-h-40 px-1 py-3",
    folderSlot: "h-32 w-full",
    folderScale: "scale-[0.37]",
    folderSize: "md",
    title: "text-sm mt-2",
    sub: "text-xs mt-0.5",
  },
  md: {
    grid: "grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-x-0 gap-y-4 sm:gap-x-1 sm:gap-y-5",
    item: "min-h-48 p-4 sm:min-h-56 sm:p-6",
    folderSlot: "h-40 w-full sm:h-44",
    folderScale: "scale-[0.44] sm:scale-[0.48]",
    folderSize: "md",
    title: "text-sm mt-3 sm:mt-4 sm:text-lg",
    sub: "text-xs mt-1 sm:text-sm",
  },
  lg: {
    grid: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-1 gap-y-5 sm:gap-x-2 sm:gap-y-7",
    item: "min-h-60 p-6 sm:min-h-64 sm:p-8",
    folderSlot: "h-48 w-full sm:h-56",
    folderScale: "scale-[0.52] sm:scale-[0.58]",
    folderSize: "lg",
    title: "text-base mt-4 sm:mt-5 sm:text-xl",
    sub: "text-sm mt-1",
  },
};

export function FolderGrid({
  items,
  mobileTwoColumns = false,
  sizeScale = "sm",
  onFolderMenu,
  onFolderOpen,
  onDropItem,
}: {
  items: FolderItem[];
  mobileTwoColumns?: boolean;
  sizeScale?: FolderSizeScale;
  onFolderMenu?: (event: MouseEvent<HTMLElement>, folder: FolderItem) => void;
  onFolderOpen?: (folder: FolderItem) => void;
  onDropItem?: (fileId: string, folderId: string) => void;
}) {
  const cfg = scaleConfig[sizeScale];
  return (
    <div
      className={cn(
        "mt-6 grid",
        cfg.grid,
        mobileTwoColumns && sizeScale === "md" && "grid-cols-2",
      )}
    >
      {items.map((folder) => (
        // biome-ignore lint/a11y/useSemanticElements: menu button is nested inside folder item
        <div
          key={folder.id || folder.name}
          role="button"
          tabIndex={0}
          onClick={() => onFolderOpen?.(folder)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onFolderOpen?.(folder);
            }
          }}
          onContextMenu={(event) => onFolderMenu?.(event, folder)}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }}
          onDragEnter={(event) => {
            event.currentTarget.classList.add("ring-2", "ring-primary/30");
          }}
          onDragLeave={(event) => {
            event.currentTarget.classList.remove("ring-2", "ring-primary/30");
          }}
          onDrop={(event) => {
            event.preventDefault();
            event.currentTarget.classList.remove("ring-2", "ring-primary/30");
            const fileId = event.dataTransfer.getData("text/plain");
            if (fileId && folder.id) onDropItem?.(fileId, folder.id);
          }}
          className={cn(
            "group relative flex cursor-pointer flex-col items-center justify-center overflow-visible bg-transparent transition hover:-translate-y-1",
            cfg.item,
          )}
        >
          <button
            type="button"
            className="absolute right-0 top-0 z-10 flex h-8 w-8 items-center justify-center rounded-xl text-muted opacity-0 transition hover:bg-surface-secondary/80 group-hover:opacity-100"
            onClick={(event) => {
              event.stopPropagation();
              onFolderMenu?.(event, folder);
            }}
            aria-label={`Open ${folder.name} menu`}
          >
            <EllipsisVertical className="h-4 w-4" />
          </button>
          <div
            className={cn(
              "flex items-center justify-center overflow-visible",
              cfg.folderSlot,
            )}
          >
            <div className={cn("origin-center", cfg.folderScale)}>
              <Folder
                color={folderColorToTheme(folder.color)}
                size={cfg.folderSize}
              />
            </div>
          </div>
          <h2
            className={cn(
              "line-clamp-2 text-center font-extrabold leading-tight",
              cfg.title,
            )}
          >
            {folder.name}
          </h2>
          <p className={cn("line-clamp-1 text-center text-muted", cfg.sub)}>
            {folder.updated}
          </p>
        </div>
      ))}
    </div>
  );
}
