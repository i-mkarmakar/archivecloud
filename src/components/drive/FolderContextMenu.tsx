import {
  ArrowDownToLine,
  ArrowUpRightFromSquare,
  CircleInfo,
  FolderArrowRight,
  FolderOpen,
  FolderPlus,
  Pencil,
  Tag,
  TrashBin,
} from "@gravity-ui/icons";
import type { FolderItem } from "@/data/drive-data";

type Props = {
  x: number;
  y: number;
  folder: FolderItem | null;
  goToDriveLabel?: string;
  onClose: () => void;
  onDetails: () => void;
  onOpen: () => void;
  onGoToDrive: () => void;
  onRename: () => void;
  onDownload: () => void;
  onMove: () => void;
  onRemove: () => void;
  onManageTags: () => void;
  onAddToVirtualFolder: () => void;
};

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger = false,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
        danger
          ? "text-danger hover:bg-danger-soft"
          : "text-foreground hover:bg-black/5",
      ].join(" ")}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 text-left">{label}</span>
    </button>
  );
}

export function FolderContextMenu({
  x,
  y,
  folder,
  goToDriveLabel = "Go to Drive",
  onClose,
  onDetails,
  onOpen,
  onGoToDrive,
  onRename,
  onDownload,
  onMove,
  onRemove,
  onManageTags,
  onAddToVirtualFolder,
}: Props) {
  if (!folder) return null;

  const safeX = Math.max(12, Math.min(x, window.innerWidth - 240));
  const safeY = Math.max(12, Math.min(y, window.innerHeight - 400));
  const run = (action: () => void) => {
    onClose();
    action();
  };

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 cursor-default"
        aria-label="Close folder menu"
        onClick={onClose}
      />
      <div
        className="fixed z-50 flex w-56 flex-col overflow-hidden rounded-xl border border-border/70 bg-white p-1.5 shadow-xl"
        style={
          window.innerWidth >= 640
            ? { left: safeX, top: safeY }
            : { insetInline: "0.75rem", bottom: "0.75rem", position: "fixed" }
        }
      >
        <MenuItem
          icon={CircleInfo}
          label="Details"
          onClick={() => run(onDetails)}
        />
        <MenuItem icon={FolderOpen} label="Open" onClick={() => run(onOpen)} />
        <MenuItem
          icon={ArrowUpRightFromSquare}
          label={goToDriveLabel}
          onClick={() => run(onGoToDrive)}
        />
        <MenuItem icon={Pencil} label="Rename" onClick={() => run(onRename)} />
        <MenuItem
          icon={ArrowDownToLine}
          label="Download"
          onClick={() => run(onDownload)}
        />
        <MenuItem
          icon={FolderArrowRight}
          label="Move"
          onClick={() => run(onMove)}
        />
        <MenuItem
          icon={TrashBin}
          label="Remove"
          onClick={() => run(onRemove)}
          danger
        />
        <MenuItem
          icon={Tag}
          label="Manage Tags"
          onClick={() => run(onManageTags)}
        />
        <MenuItem
          icon={FolderPlus}
          label="Add to Virtual Folder"
          onClick={() => run(onAddToVirtualFolder)}
        />
      </div>
    </>
  );
}
