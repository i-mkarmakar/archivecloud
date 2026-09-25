import {
  ArrowDownToLine,
  EllipsisVertical,
  FolderArrowRight,
  Link,
  PersonPlus,
  TrashBin,
  Xmark,
} from "@gravity-ui/icons";
import type { Dispatch, MouseEvent, SetStateAction } from "react";
import type { FileItem } from "@/data/drive-data";

export function AllFilesSelectionBar(props: {
  selectedFileIds: Set<string>;
  displayFiles: FileItem[];
  clearSelection: () => void;
  shareFile: (fileOverride?: FileItem | null) => void;
  copyShareLinkDirect: (fileOverride?: FileItem | null) => Promise<void>;
  downloadBatchAsZip: () => Promise<void>;
  openMoveForFiles: (filesToMove: FileItem[]) => void;
  setDeleteOpen: Dispatch<SetStateAction<boolean>>;
  openContext: (event: MouseEvent<HTMLElement>, file: FileItem) => void;
}) {
  const {
    selectedFileIds,
    displayFiles,
    clearSelection,
    shareFile,
    copyShareLinkDirect,
    downloadBatchAsZip,
    openMoveForFiles,
    setDeleteOpen,
    openContext,
  } = props;

  return selectedFileIds.size > 0 ? (
    <div className="mt-4 flex flex-col gap-2 sm:mt-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
        <div className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-border/80 bg-white py-1 pl-2 pr-1.5 shadow-sm dark:bg-surface">
          <button
            type="button"
            onClick={clearSelection}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Clear selection"
          >
            <Xmark className="h-5 w-5" />
          </button>
          <span className="mr-1 shrink-0 whitespace-nowrap pr-2 text-sm font-medium text-foreground">
            {selectedFileIds.size} selected
          </span>
          <div className="mx-1 hidden h-5 w-px shrink-0 bg-border sm:block" />
          {selectedFileIds.size === 1 ? (
            <>
              <button
                type="button"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="Share"
                title="Share"
                onClick={() => {
                  const id = [...selectedFileIds][0];
                  const file = displayFiles.find((item) => item.id === id);
                  if (!file) return;
                  void shareFile(file);
                }}
              >
                <PersonPlus className="h-5 w-5" />
              </button>
              <button
                type="button"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="Copy link"
                title="Copy link"
                onClick={() => {
                  const id = [...selectedFileIds][0];
                  const file = displayFiles.find((item) => item.id === id);
                  if (!file) return;
                  void copyShareLinkDirect(file);
                }}
              >
                <Link className="h-5 w-5" />
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Download as ZIP"
            title="Download ZIP"
            onClick={downloadBatchAsZip}
          >
            <ArrowDownToLine className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Move"
            title="Move"
            onClick={() => {
              const selected = displayFiles.filter(
                (file) => file.id && selectedFileIds.has(file.id),
              );
              openMoveForFiles(selected);
            }}
          >
            <FolderArrowRight className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Delete"
            title="Delete"
            onClick={() => setDeleteOpen(true)}
          >
            <TrashBin className="h-5 w-5" />
          </button>
          {selectedFileIds.size === 1 ? (
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-black/5 dark:hover:bg-white/10"
              aria-label="More actions"
              title="More"
              onClick={(event) => {
                const id = [...selectedFileIds][0];
                const file = displayFiles.find((item) => item.id === id);
                if (!file) return;
                openContext(event, file);
              }}
            >
              <EllipsisVertical className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  ) : null;
}
