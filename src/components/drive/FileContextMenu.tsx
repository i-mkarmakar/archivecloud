import {
  ArrowDownToLine,
  ArrowUpRightFromSquare,
  CircleInfo,
  FolderArrowRight,
  FolderPlus,
  NodesRight,
  Pencil,
  Tag,
  TrashBin,
} from "@gravity-ui/icons";
import type { FileItem } from "@/data/drive-data";

type Props = {
  x: number;
  y: number;
  file: FileItem | null;
  onClose: () => void;
  onDetails: () => void;
  onGoToDrive: () => void;
  onRename: () => void;
  onDownload: () => void;
  onMove: () => void;
  onRemove: () => void;
  onManageTags: () => void;
  onPublicLink: () => void;
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
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
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

export function FileContextMenu({
  x,
  y,
  file,
  onClose,
  onDetails,
  onGoToDrive,
  onRename,
  onDownload,
  onMove,
  onRemove,
  onManageTags,
  onPublicLink,
  onAddToVirtualFolder,
}: Props) {
  if (!file) return null;

  const safeX = Math.max(12, Math.min(x, window.innerWidth - 240));
  const safeY = Math.max(12, Math.min(y, window.innerHeight - 380));

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 cursor-default"
        aria-label="Close file menu"
        onClick={onClose}
      />
      <div
        className="fixed z-50 w-56 overflow-hidden rounded-xl border border-border/70 bg-white p-1.5 shadow-xl"
        style={
          window.innerWidth >= 640
            ? { left: safeX, top: safeY }
            : { insetInline: "0.75rem", bottom: "0.75rem", position: "fixed" }
        }
      >
        <MenuItem icon={CircleInfo} label="Details" onClick={onDetails} />
        <MenuItem
          icon={ArrowUpRightFromSquare}
          label="Go to Google Drive"
          onClick={onGoToDrive}
        />
        <MenuItem icon={Pencil} label="Rename" onClick={onRename} />
        <MenuItem
          icon={ArrowDownToLine}
          label="Download"
          onClick={onDownload}
        />
        <MenuItem icon={FolderArrowRight} label="Move" onClick={onMove} />
        <MenuItem icon={TrashBin} label="Remove" onClick={onRemove} danger />
        <MenuItem icon={Tag} label="Manage Tags" onClick={onManageTags} />
        <MenuItem
          icon={NodesRight}
          label="Public Link"
          onClick={onPublicLink}
        />
        <MenuItem
          icon={FolderPlus}
          label="Add to Virtual Folder"
          onClick={onAddToVirtualFolder}
        />
      </div>
    </>
  );
}
