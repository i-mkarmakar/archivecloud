"use client";

import { EllipsisVertical } from "@gravity-ui/icons";
import type { MouseEvent } from "react";
import { useState } from "react";
import { AccountAccessBadge } from "@/components/drive/AccountAccessBadge";
import { FileIcon } from "@/components/drive/FileIcon";
import type { FileItem } from "@/data/drive-data";
import { cn } from "@/lib/utils";

export type FileSizeScale = "xs" | "sm" | "md" | "lg";

const scaleConfig: Record<
  FileSizeScale,
  {
    grid: string;
    preview: string;
    title: string;
    icon: string;
    header: string;
    body: string;
    footer: string;
    menu: string;
    placeholderIcon: string;
  }
> = {
  xs: {
    grid: "grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-1.5 gap-y-2 sm:gap-x-4 sm:gap-y-6",
    preview: "aspect-[4/3] sm:aspect-[5/3]",
    title: "text-[9px] sm:text-xs",
    icon: "h-2.5 w-2.5 sm:h-3.5 sm:w-3.5",
    header: "gap-0.5 px-1 pt-1 pb-0.5 sm:gap-1.5 sm:px-2 sm:pt-2 sm:pb-1.5",
    body: "px-0.5 pb-0.5 sm:px-1.5 sm:pb-1.5",
    footer: "gap-0.5 px-1 pb-1 pt-0 sm:gap-1.5 sm:px-2 sm:pb-2",
    menu: "h-4 w-4 sm:h-6 sm:w-6",
    placeholderIcon: "h-5 w-5 rounded p-1 sm:h-8 sm:w-8 sm:rounded-md sm:p-1.5",
  },
  sm: {
    grid: "grid-cols-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-1.5 sm:gap-2.5",
    preview: "aspect-[4/3] sm:aspect-[16/10]",
    title: "text-[10px] sm:text-sm",
    icon: "h-3 w-3 sm:h-4 sm:w-4",
    header: "gap-1 px-1.5 pt-1.5 pb-1 sm:gap-2 sm:px-3 sm:pt-3 sm:pb-2",
    body: "px-1 pb-1 sm:px-2 sm:pb-2",
    footer: "gap-1 px-1.5 pb-1.5 pt-0 sm:gap-2 sm:px-3 sm:pb-3 sm:pt-0.5",
    menu: "h-5 w-5 sm:h-8 sm:w-8",
    placeholderIcon: "h-7 w-7 rounded-md p-1.5 sm:h-12 sm:w-12 sm:p-2.5",
  },
  md: {
    grid: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4",
    preview: "aspect-[16/10]",
    title: "text-sm",
    icon: "h-[18px] w-[18px]",
    header: "gap-2 px-3 pt-3 pb-2",
    body: "px-2 pb-2",
    footer: "gap-2 px-3 pb-3 pt-0.5",
    menu: "h-8 w-8",
    placeholderIcon: "h-12 w-12 rounded-md p-2.5 sm:h-14 sm:w-14",
  },
  lg: {
    grid: "grid-cols-1 sm:grid-cols-2 gap-5",
    preview: "aspect-[16/10]",
    title: "text-base",
    icon: "h-5 w-5",
    header: "gap-2 px-3 pt-3 pb-2",
    body: "px-2 pb-2",
    footer: "gap-2 px-3 pb-3 pt-0.5",
    menu: "h-8 w-8",
    placeholderIcon: "h-12 w-12 rounded-md p-2.5 sm:h-14 sm:w-14",
  },
};

function formatActivityDate(file: FileItem) {
  const raw =
    file.lastAccessedAt ?? file.updatedAt ?? file.createdAt ?? file.date;
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(parsed);
}

function activityLabel(file: FileItem) {
  const shortDate = formatActivityDate(file);
  if (file.lastAccessedAt && shortDate) return `You opened • ${shortDate}`;
  if (file.updatedAt && shortDate) return `Modified • ${shortDate}`;
  if (shortDate) return `Added • ${shortDate}`;
  return file.openedDate ? `Opened • ${file.openedDate}` : "In Drive";
}

function DriveFileCard({
  file,
  selected,
  sizeScale,
  onFileContextMenu,
  onToggleFile,
  onFileOpen,
}: {
  file: FileItem;
  selected: boolean;
  sizeScale: FileSizeScale;
  onFileContextMenu?: (event: MouseEvent<HTMLElement>, file: FileItem) => void;
  onToggleFile?: (file: FileItem) => void;
  onFileOpen?: (file: FileItem) => void;
}) {
  const cfg = scaleConfig[sizeScale];
  const [thumbFailed, setThumbFailed] = useState(false);
  const showThumb = Boolean(file.thumbnailUrl) && !thumbFailed;

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: file card supports click-to-select alongside drag
    // biome-ignore lint/a11y/noStaticElementInteractions: file card supports click-to-select alongside drag
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: selection state exposed for assistive tech on file cards
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", file.id ?? "");
        event.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => onToggleFile?.(file)}
      onDoubleClick={() => onFileOpen?.(file)}
      onContextMenu={(event) => onFileContextMenu?.(event, file)}
      aria-selected={selected}
      className={cn(
        "group relative flex cursor-grab flex-col overflow-hidden border transition active:cursor-grabbing",
        sizeScale === "xs" ? "rounded-lg" : "rounded-xl",
        selected
          ? "border-primary bg-primary/25 dark:border-primary dark:bg-primary/25"
          : "border-transparent bg-[#f0f4f9] hover:shadow-sm dark:bg-surface-secondary",
      )}
    >
      <div className={cn("flex items-center", cfg.header)}>
        <FileIcon kind={file.kind} className={cn("shrink-0", cfg.icon)} />
        <h3
          className={cn(
            "min-w-0 flex-1 truncate font-medium text-foreground",
            cfg.title,
          )}
          title={file.name}
        >
          {file.name}
        </h3>
        <button
          type="button"
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full text-muted hover:bg-black/5 dark:hover:bg-white/10",
            cfg.menu,
          )}
          onClick={(event) => {
            event.stopPropagation();
            onFileContextMenu?.(event, file);
          }}
          aria-label={`Open ${file.name} menu`}
        >
          <EllipsisVertical
            className={cn(
              sizeScale === "xs" || sizeScale === "sm"
                ? "h-3 w-3 sm:h-3.5 sm:w-3.5"
                : "h-3.5 w-3.5",
            )}
          />
        </button>
      </div>

      <div className={cfg.body}>
        <div
          className={cn(
            "relative flex items-center justify-center overflow-hidden rounded-md bg-white dark:bg-background",
            sizeScale === "xs" ? "rounded-md" : "rounded-lg",
            cfg.preview,
          )}
        >
          {showThumb ? (
            <img
              src={file.thumbnailUrl ?? undefined}
              alt=""
              className="h-full w-full rounded-sm object-cover"
              loading="lazy"
              onError={() => setThumbFailed(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-sm bg-[#e8eaed] dark:bg-background-secondary">
              <FileIcon kind={file.kind} className={cfg.placeholderIcon} />
            </div>
          )}
        </div>
      </div>

      <div className={cn("flex items-center", cfg.footer)}>
        <AccountAccessBadge file={file} compact={sizeScale === "xs"} />
        <p
          className={cn(
            "min-w-0 truncate text-muted",
            sizeScale === "xs"
              ? "text-[8px] sm:text-[10px]"
              : sizeScale === "sm"
                ? "text-[9px] sm:text-xs"
                : "text-xs",
          )}
          title={file.accountEmail ?? undefined}
        >
          {activityLabel(file)}
        </p>
      </div>
    </div>
  );
}

export function FileGrid({
  files,
  selectedFileIds = new Set<string>(),
  sizeScale = "sm",
  onFileContextMenu,
  onToggleFile,
  onFileOpen,
}: {
  files: FileItem[];
  selectedFileIds?: Set<string>;
  sizeScale?: FileSizeScale;
  onFileContextMenu?: (event: MouseEvent<HTMLElement>, file: FileItem) => void;
  onToggleFile?: (file: FileItem) => void;
  onFileOpen?: (file: FileItem) => void;
}) {
  const cfg = scaleConfig[sizeScale];
  return (
    <div className={cn("mt-0 grid", cfg.grid)}>
      {files.map((file) => (
        <DriveFileCard
          key={file.id ?? file.name}
          file={file}
          selected={selectedFileIds.has(file.id ?? "")}
          sizeScale={sizeScale}
          onFileContextMenu={onFileContextMenu}
          onToggleFile={onToggleFile}
          onFileOpen={onFileOpen}
        />
      ))}
    </div>
  );
}
