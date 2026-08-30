import {
  Copy,
  FolderOpen,
  Pencil,
  PersonPlus,
  Scissors,
  TrashBin,
} from "@gravity-ui/icons";
import type { FolderItem } from "@/data/drive-data";

type Props = {
  x: number;
  y: number;
  folder: FolderItem | null;
  onClose: () => void;
  onCut: () => void;
  onRename: () => void;
  onInvite: () => void;
  onCopyLink: () => void;
  onDelete: () => void;
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
          ? "text-danger hover:bg-danger-soft dark:text-red-400 dark:hover:bg-red-950/40"
          : "text-foreground hover:bg-surface-secondary dark:text-foreground dark:hover:bg-accent/70",
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

export function FolderContextMenu({
  x,
  y,
  folder,
  onClose,
  onCut,
  onRename,
  onInvite,
  onCopyLink,
  onDelete,
}: Props) {
  if (!folder) return null;
  const safeX = Math.max(12, Math.min(x, window.innerWidth - 228));
  const safeY = Math.max(12, Math.min(y, window.innerHeight - 280));

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 cursor-default"
        aria-label="Close folder menu"
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
        {/* Header */}
        <div className="border-b border-separator bg-background-secondary/80 px-3.5 py-3 dark:border-border dark:bg-accent/50">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-secondary dark:bg-accent/40">
              <FolderOpen className="h-3.5 w-3.5 text-muted" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold leading-tight text-foreground dark:text-foreground">
                {folder.name}
              </p>
              <p className="text-[10px] font-medium text-muted dark:text-muted">
                Virtual folder
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-1.5">
          <MenuItem icon={Copy} label="Copy Link" onClick={onCopyLink} />
          <MenuItem icon={Scissors} label="Cut" onClick={onCut} kbd="⌘X" />
          <MenuItem icon={Pencil} label="Rename" onClick={onRename} />
          <MenuItem
            icon={PersonPlus}
            label="Invite Member"
            onClick={onInvite}
          />
          <div className="my-1 h-px bg-surface-secondary dark:bg-accent" />
          <MenuItem
            icon={TrashBin}
            label="Delete Folder"
            onClick={onDelete}
            danger
          />
        </div>
      </div>
    </>
  );
}
