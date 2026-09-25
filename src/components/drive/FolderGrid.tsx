"use client";

import { EllipsisVertical } from "@gravity-ui/icons";
import type { MouseEvent } from "react";
import { normalizeFolderColor } from "@/components/drive/folder-colors";
import { Folder } from "@/components/folder/Folder";
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
    grid: "grid-cols-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-x-1.5 gap-y-2 sm:gap-x-3 sm:gap-y-3",
    item: "min-h-24 min-w-0 px-0.5 py-0.5 sm:min-h-36 sm:px-1.5 sm:py-1",
    folderSlot: "h-16 w-full sm:h-24",
    folderScale: "scale-[0.22] sm:scale-[0.3]",
    folderSize: "sm",
    title: "text-[10px] mt-0.5 sm:mt-1 sm:text-sm",
    sub: "text-[8px] mt-0.5 sm:text-xs",
  },
  sm: {
    grid: "grid-cols-3 sm:grid-cols-3 xl:grid-cols-4 gap-x-2 gap-y-3 sm:gap-x-3",
    item: "min-h-36 min-w-0 px-1 py-1 sm:min-h-40 sm:px-2",
    folderSlot: "h-24 w-full sm:h-28",
    folderScale: "scale-[0.3] sm:scale-[0.34]",
    folderSize: "md",
    title: "text-xs mt-1 sm:text-sm",
    sub: "text-[10px] mt-0.5 sm:text-xs",
  },
  md: {
    grid: "grid-cols-3 sm:grid-cols-3 xl:grid-cols-4 gap-x-2 gap-y-3 sm:gap-x-3",
    item: "min-h-40 min-w-0 p-1 sm:min-h-56 sm:p-2",
    folderSlot: "h-32 w-full sm:h-44",
    folderScale: "scale-[0.36] sm:scale-[0.48]",
    folderSize: "md",
    title: "text-xs mt-1.5 sm:mt-2 sm:text-lg",
    sub: "text-[10px] mt-0.5 sm:text-sm",
  },
  lg: {
    grid: "grid-cols-3 sm:grid-cols-2 xl:grid-cols-3 gap-x-2 gap-y-3 sm:gap-x-4 sm:gap-y-4",
    item: "min-h-48 min-w-0 p-1.5 sm:min-h-64 sm:p-3",
    folderSlot: "h-40 w-full sm:h-56",
    folderScale: "scale-[0.42] sm:scale-[0.58]",
    folderSize: "lg",
    title: "text-sm mt-1.5 sm:mt-3 sm:text-xl",
    sub: "text-xs mt-0.5 sm:text-sm",
  },
};

export function FolderGrid({
  items,
  sizeScale = "sm",
  onFolderMenu,
  onFolderOpen,
  onDropItem,
}: {
  items: FolderItem[];
  /** @deprecated No longer used; mobile grids are always 3 columns. */
  mobileTwoColumns?: boolean;
  sizeScale?: FolderSizeScale;
  onFolderMenu?: (event: MouseEvent<HTMLElement>, folder: FolderItem) => void;
  onFolderOpen?: (folder: FolderItem) => void;
  onDropItem?: (fileId: string, folderId: string) => void;
}) {
  const cfg = scaleConfig[sizeScale];
  return (
    <div className={cn("mt-0 grid", cfg.grid)}>
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
            "group relative flex cursor-pointer flex-col items-center justify-start overflow-hidden bg-transparent transition hover:-translate-y-1",
            cfg.item,
          )}
        >
          <button
            type="button"
            className="absolute right-0.5 top-0.5 z-10 flex h-8 w-8 items-center justify-center rounded-xl text-muted opacity-0 transition hover:bg-surface-secondary/80 group-hover:opacity-100"
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
              "flex shrink-0 items-center justify-center overflow-hidden",
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
              "line-clamp-2 w-full min-w-0 text-center font-extrabold leading-tight",
              cfg.title,
            )}
            title={folder.name}
          >
            {folder.name}
          </h2>
          <p
            className={cn(
              "line-clamp-1 w-full min-w-0 text-center text-muted",
              cfg.sub,
            )}
            title={folder.updated}
          >
            {folder.updated}
          </p>
        </div>
      ))}
    </div>
  );
}
