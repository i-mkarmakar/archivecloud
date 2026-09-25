"use client";

import { ChevronDown, EllipsisVertical } from "@gravity-ui/icons";
import type { MouseEvent } from "react";
import { useEffect, useState } from "react";
import { normalizeFolderColor } from "@/components/drive/folder-colors";
import { Folder } from "@/components/folder/Folder";
import { ProviderBrandIcon } from "@/components/ProviderBrandIcon";
import type { FolderItem } from "@/data/drive-data";
import { providerLabel } from "@/lib/providers";
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
    grid: "grid-cols-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-x-0.5 gap-y-0 sm:gap-x-1 sm:gap-y-0",
    item: "min-h-0 min-w-0 px-0.5 py-0 sm:min-h-0 sm:px-1.5 sm:py-0",
    folderSlot: "h-14 w-full sm:h-[5.5rem]",
    folderScale: "scale-[0.22] sm:scale-[0.3]",
    folderSize: "sm",
    title: "text-[10px] mt-0 sm:text-sm",
    sub: "text-[7px] mt-0 sm:text-[10px]",
  },
  sm: {
    grid: "grid-cols-3 sm:grid-cols-3 xl:grid-cols-4 gap-x-1 gap-y-0 sm:gap-x-1.5 sm:gap-y-0.5",
    item: "min-h-0 min-w-0 px-1 py-0 sm:min-h-0 sm:px-2 sm:py-0",
    folderSlot: "h-[5.5rem] w-full sm:h-[6.5rem]",
    folderScale: "scale-[0.3] sm:scale-[0.34]",
    folderSize: "md",
    title: "text-xs mt-0 sm:text-sm",
    sub: "text-[8px] mt-0 sm:text-[10px]",
  },
  md: {
    grid: "grid-cols-3 sm:grid-cols-3 xl:grid-cols-4 gap-x-1 gap-y-0 sm:gap-x-1.5 sm:gap-y-0.5",
    item: "min-h-0 min-w-0 p-1 pt-0 pb-0 sm:min-h-0 sm:p-2 sm:pt-0 sm:pb-0",
    folderSlot: "h-28 w-full sm:h-[10.5rem]",
    folderScale: "scale-[0.36] sm:scale-[0.48]",
    folderSize: "md",
    title: "text-xs mt-0.5 sm:text-lg",
    sub: "text-[9px] mt-0 sm:text-xs",
  },
  lg: {
    grid: "grid-cols-3 sm:grid-cols-2 xl:grid-cols-3 gap-x-1 gap-y-0 sm:gap-x-2 sm:gap-y-0.5",
    item: "min-h-0 min-w-0 p-1.5 pt-0 pb-0 sm:min-h-0 sm:p-3 sm:pt-0 sm:pb-0",
    folderSlot: "h-36 w-full sm:h-52",
    folderScale: "scale-[0.42] sm:scale-[0.58]",
    folderSize: "lg",
    title: "text-sm mt-0.5 sm:text-xl",
    sub: "text-[10px] mt-0 sm:text-xs",
  },
};

/** Column counts matching Tailwind breakpoints used in `scaleConfig` grids. */
function columnsForScale(sizeScale: FolderSizeScale, width: number): number {
  if (sizeScale === "xs") {
    if (width >= 1280) return 5;
    if (width >= 768) return 4;
    return 3;
  }
  if (sizeScale === "lg") {
    if (width >= 1280) return 3;
    if (width >= 640) return 2;
    return 3;
  }
  // sm + md
  if (width >= 1280) return 4;
  return 3;
}

function usePreviewLimit(sizeScale: FolderSizeScale, previewRows: number) {
  const [limit, setLimit] = useState(() => previewRows * 3);

  useEffect(() => {
    const update = () => {
      setLimit(columnsForScale(sizeScale, window.innerWidth) * previewRows);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [sizeScale, previewRows]);

  return limit;
}

export function FolderGrid({
  items,
  sizeScale = "sm",
  previewRows,
  onFolderMenu,
  onFolderOpen,
  onDropItem,
}: {
  items: FolderItem[];
  /** @deprecated No longer used; mobile grids are always 3 columns. */
  mobileTwoColumns?: boolean;
  sizeScale?: FolderSizeScale;
  /** When set, only this many rows show until the user clicks Show More. */
  previewRows?: number;
  onFolderMenu?: (event: MouseEvent<HTMLElement>, folder: FolderItem) => void;
  onFolderOpen?: (folder: FolderItem) => void;
  onDropItem?: (fileId: string, folderId: string) => void;
}) {
  const cfg = scaleConfig[sizeScale];
  const [showAll, setShowAll] = useState(false);
  const previewLimit = usePreviewLimit(sizeScale, previewRows ?? 2);
  const collapseEnabled = typeof previewRows === "number" && previewRows > 0;
  const canToggleMore = collapseEnabled && items.length > previewLimit;
  const visibleItems =
    collapseEnabled && !showAll ? items.slice(0, previewLimit) : items;

  useEffect(() => {
    setShowAll(false);
  }, [items.length, previewLimit]);

  return (
    <div>
      <div className="relative">
        <div className={cn("mt-0 grid", cfg.grid)}>
          {visibleItems.map((folder) => (
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
                event.currentTarget.classList.remove(
                  "ring-2",
                  "ring-primary/30",
                );
              }}
              onDrop={(event) => {
                event.preventDefault();
                event.currentTarget.classList.remove(
                  "ring-2",
                  "ring-primary/30",
                );
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
                  "flex shrink-0 items-end justify-center overflow-hidden pb-0",
                  cfg.folderSlot,
                )}
              >
                <div className={cn("origin-bottom", cfg.folderScale)}>
                  <Folder
                    color={folderColorToTheme(folder.color)}
                    size={cfg.folderSize}
                  />
                </div>
              </div>
              <h2
                className={cn(
                  "flex w-full min-w-0 items-center justify-center gap-1 text-center font-extrabold leading-tight",
                  cfg.title,
                )}
                title={folder.name}
              >
                {folder.accountProvider ? (
                  <ProviderBrandIcon
                    name={folder.accountProvider}
                    className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"
                    fallback={
                      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-[8px] font-bold text-primary sm:h-4 sm:w-4 sm:text-[10px]">
                        {providerLabel(folder.accountProvider).charAt(0)}
                      </span>
                    }
                  />
                ) : null}
                <span className="line-clamp-2 min-w-0">{folder.name}</span>
              </h2>
              {folder.accountEmail ? (
                <p
                  className={cn(
                    "line-clamp-1 w-full min-w-0 text-center text-muted",
                    cfg.sub,
                  )}
                  title={folder.accountEmail}
                >
                  {folder.accountEmail}
                </p>
              ) : folder.updated ? (
                <p
                  className={cn(
                    "line-clamp-1 w-full min-w-0 text-center text-muted",
                    cfg.sub,
                  )}
                  title={folder.updated}
                >
                  {folder.updated}
                </p>
              ) : null}
            </div>
          ))}
        </div>

        {canToggleMore && !showAll ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-background to-transparent sm:h-10"
          />
        ) : null}
      </div>

      {canToggleMore ? (
        <div className="relative z-10 -mt-2 flex justify-center sm:mt-1">
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border border-border bg-background px-2.5 text-[11px] font-semibold text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:border-primary/40 hover:bg-primary/5 sm:h-8 sm:px-3 sm:text-xs dark:hover:bg-primary/10"
          >
            {showAll ? "Show Less" : "Show More"}
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform sm:h-3.5 sm:w-3.5",
                showAll && "rotate-180",
              )}
            />
          </button>
        </div>
      ) : null}
    </div>
  );
}
