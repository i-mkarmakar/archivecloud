import { Button } from "@heroui/react";
import {
  Clock,
  Database,
  Envelope,
  Folder,
  HardDrive,
  Tag,
  Xmark,
} from "@gravity-ui/icons";
import type { FileItem } from "@/data/drive-data";
import { formatBytes, formatDate } from "@/lib/api";

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Tag;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-background-secondary p-3">
      <Icon className="mt-0.5 h-4 w-4 text-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">
          {label}
        </p>
        <p className="mt-1 break-words text-sm font-semibold text-foreground">
          {value}
        </p>
      </div>
    </div>
  );
}

export function FileDetailsDrawer({
  open,
  file,
  onClose,
}: {
  open: boolean;
  file: FileItem | null;
  onClose: () => void;
}) {
  return (
    <>
      <button
        type="button"
        className={
          open
            ? "fixed inset-0 z-40 bg-backdrop/30"
            : "pointer-events-none fixed inset-0 z-40 bg-backdrop/0"
        }
        aria-label="Close file details"
        onClick={onClose}
      />
      <aside
        className={
          open
            ? "fixed right-0 top-0 z-50 h-full w-full max-w-md translate-x-0 border-l border-border bg-surface shadow-overlay transition-transform duration-300"
            : "fixed right-0 top-0 z-50 h-full w-full max-w-md translate-x-full border-l border-border bg-surface shadow-overlay transition-transform duration-300"
        }
      >
        <div className="flex items-center justify-between border-b border-border p-5">
          <div>
            <h2 className="text-xl font-extrabold">File Details</h2>
            <p className="mt-1 max-w-[18rem] truncate text-sm text-muted">
              {file?.name ?? "No file selected"}
            </p>
          </div>
          <Button
            variant="outline"
            isIconOnly
            size="sm"
            onClick={onClose}
            aria-label="Close file details"
          >
            <Xmark className="h-5 w-5" />
          </Button>
        </div>
        {file ? (
          <div className="grid gap-3 p-5">
            <DetailRow icon={Tag} label="Name" value={file.name} />
            <DetailRow
              icon={Database}
              label="Size"
              value={file.sizeBytes ? formatBytes(file.sizeBytes) : file.size}
            />
            <DetailRow
              icon={Clock}
              label="Uploaded At"
              value={file.createdAt ? formatDate(file.createdAt) : file.date}
            />
            <DetailRow
              icon={Envelope}
              label="Google Account"
              value={file.accountEmail ?? file.access}
            />
            <DetailRow
              icon={HardDrive}
              label="Provider"
              value={file.accountProvider ?? "google_drive"}
            />
            <DetailRow
              icon={Folder}
              label="Virtual Folder"
              value={file.folderName ?? "No folder"}
            />
            <DetailRow
              icon={Tag}
              label="MIME Type"
              value={file.mimeType ?? "Unknown"}
            />
          </div>
        ) : null}
      </aside>
    </>
  );
}
