import {
  ArrowDownToLine,
  Archive,
  CircleInfo,
  Copy,
  Eye,
  FolderArrowRight,
  Link,
  Pencil,
  PersonPlus,
  Star,
  TrashBin,
} from "@gravity-ui/icons";
import type { FileItem } from "@/data/drive-data";

type Props = {
  x: number;
  y: number;
  file: FileItem | null;
  onClose: () => void;
  onView: () => void;
  onDownload: () => void;
  onRename: () => void;
  onMove: () => void;
  onDetails: () => void;
  onShare: () => void;
  onCopyLink: () => void;
  onInvite: () => void;
  onToggleStar: () => void;
  onArchive: () => void;
  onDelete: () => void;
};

const kindColors: Record<string, string> = {
  image: "bg-success",
  video: "bg-accent",
  pdf: "bg-danger",
  doc: "bg-warning",
};

const kindLabels: Record<string, string> = {
  image: "Image",
  video: "Video",
  pdf: "PDF",
  doc: "Document",
};

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger = false,
  kbd,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  danger?: boolean;
  kbd?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group relative flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition-all duration-150",
        danger
          ? "text-danger hover:bg-danger-soft"
          : "text-foreground hover:bg-surface-secondary",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-150",
          danger
            ? "bg-danger-soft text-danger group-hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400"
            : "bg-surface-secondary text-muted group-hover:bg-white group-hover:shadow-sm dark:bg-accent dark:text-muted",
        ].join(" ")}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="flex-1 text-left">{label}</span>
      {kbd && (
        <kbd className="hidden rounded-md border border-border bg-background-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted group-hover:border-border dark:border-border dark:bg-accent dark:text-muted sm:inline">
          {kbd}
        </kbd>
      )}
    </button>
  );
}

export function FileContextMenu({
  x,
  y,
  file,
  onClose,
  onView,
  onDownload,
  onRename,
  onMove,
  onDetails,
  onShare,
  onCopyLink,
  onInvite,
  onToggleStar,
  onArchive,
  onDelete,
}: Props) {
  if (!file) return null;

  const safeX = Math.max(12, Math.min(x, window.innerWidth - 228));
  const safeY = Math.max(12, Math.min(y, window.innerHeight - 430));
  const kindColor = kindColors[file.kind] ?? "bg-accent";
  const kindLabel = kindLabels[file.kind] ?? "File";

  function handleShare() {
    onShare();
  }

  function handleCopyLink() {
    onCopyLink();
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 cursor-default"
        aria-label="Close file menu"
        onClick={onClose}
      />
      <div
        className="fixed z-50 w-56 overflow-hidden rounded-2xl border border-border/70 bg-overlay/95 shadow-2xl shadow-overlay backdrop-blur-2xl dark:border-border/70 dark:bg-overlay/95"
        style={
          window.innerWidth >= 640
            ? { left: safeX, top: safeY }
            : { insetInline: "0.75rem", bottom: "0.75rem", position: "fixed" }
        }
      >
        {/* Header: file name + kind badge + folder path */}
        <div className="border-b border-separator bg-background-secondary/80 px-3.5 py-3 dark:border-border dark:bg-accent/50">
          <div className="flex items-start gap-2.5">
            <span
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-black text-accent-foreground ${kindColor}`}
            >
              {kindLabel.slice(0, 3).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold leading-tight text-foreground dark:text-foreground">
                {file.name}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <span className="rounded-md bg-default/70 px-1.5 py-0.5 text-[10px] font-semibold text-muted dark:bg-accent dark:text-muted">
                  {file.size}
                </span>
                {file.folderName && (
                  <span className="flex items-center gap-0.5 rounded-md bg-surface-secondary px-1.5 py-0.5 text-[10px] font-semibold text-foreground dark:bg-accent/40 dark:text-muted">
                    <FolderArrowRight className="h-2.5 w-2.5" />
                    {file.folderName}
                  </span>
                )}
                {!file.folderName && (
                  <span className="rounded-md bg-surface-secondary px-1.5 py-0.5 text-[10px] font-semibold text-muted dark:bg-accent dark:text-muted">
                    / All Files
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-1.5">
          <MenuItem icon={Eye} label="Preview" onClick={onView} kbd="↵" />
          <MenuItem
            icon={ArrowDownToLine}
            label="Download"
            onClick={onDownload}
          />
          <MenuItem icon={Pencil} label="Rename" onClick={onRename} />
          <MenuItem
            icon={FolderArrowRight}
            label="Move to Folder"
            onClick={onMove}
          />
          <MenuItem icon={CircleInfo} label="Details" onClick={onDetails} />

          <div className="my-1 h-px bg-surface-secondary dark:bg-accent" />

          <MenuItem
            icon={Star}
            label={file.isStarred ? "Remove Star" : "Add Star"}
            onClick={onToggleStar}
          />
          <MenuItem
            icon={Archive}
            label={file.isArchived ? "Unarchive" : "Archive"}
            onClick={onArchive}
          />

          <div className="my-1 h-px bg-surface-secondary dark:bg-accent" />

          <MenuItem icon={Link} label="Share Link" onClick={handleShare} />
          <MenuItem
            icon={Copy}
            label="Copy Link"
            onClick={handleCopyLink}
            kbd="Ctrl+L"
          />
          <MenuItem
            icon={PersonPlus}
            label="Invite Member"
            onClick={onInvite}
          />

          <div className="my-1 h-px bg-surface-secondary dark:bg-accent" />

          <MenuItem icon={TrashBin} label="Delete" onClick={onDelete} danger />
        </div>
      </div>
    </>
  );
}
