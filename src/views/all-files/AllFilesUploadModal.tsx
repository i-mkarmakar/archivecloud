import { ArrowUpFromLine, Xmark } from "@gravity-ui/icons";
import { Button, Input } from "@heroui/react";
import type { DragEvent, FormEvent } from "react";
import { DummyModal } from "@/components/drive/DummyModal";
import type { FolderItem } from "@/data/drive-data";
import { formatBytes } from "@/lib/api";
import type { ConnectedAccount } from "@/views/all-files/types";

export function AllFilesUploadModal(props: {
  open: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  loading: boolean;
  isUploadDragging: boolean;
  onUploadDrag: (event: DragEvent<HTMLDivElement>) => void;
  selectedFiles: File[];
  onSelectUploadFiles: (files: FileList | File[] | null | undefined) => void;
  onRemoveUploadFile: (index: number) => void;
  accountSelect: {
    value: string;
    onChange: (value: string) => void;
    accounts: ConnectedAccount[];
  };
  folderSelect: {
    activeFolder: FolderItem | undefined;
    value: string;
    onChange: (value: string) => void;
    folders: FolderItem[];
  };
}) {
  const {
    open,
    onClose,
    onSubmit,
    loading,
    isUploadDragging,
    onUploadDrag,
    selectedFiles,
    onSelectUploadFiles,
    onRemoveUploadFile,
    accountSelect,
    folderSelect,
  } = props;

  return (
    <DummyModal
      open={open}
      title="Upload File"
      description="Stream file directly to selected Google Drive account."
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="grid gap-4">
        {/* biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop upload target */}
        <div
          onDragEnter={onUploadDrag}
          onDragOver={onUploadDrag}
          onDragLeave={onUploadDrag}
          onDrop={onUploadDrag}
          className={
            isUploadDragging
              ? "grid cursor-pointer gap-3 rounded-2xl border-2 border-dashed border-border bg-surface-secondary p-4 text-center transition sm:p-6"
              : "grid cursor-pointer gap-3 rounded-2xl border-2 border-dashed border-border bg-background-secondary p-4 text-center transition hover:border-border hover:bg-surface-secondary/50 sm:p-6"
          }
        >
          <ArrowUpFromLine
            className={
              isUploadDragging
                ? "mx-auto h-8 w-8 text-foreground"
                : "mx-auto h-8 w-8 text-muted"
            }
          />
          <span className="text-sm font-extrabold text-foreground">
            Drop file here or click to browse
          </span>
          <span className="text-xs text-muted">
            Metadata is sent before the file so upload can stream directly to
            Google Drive.
          </span>
          <Input
            type="file"
            className="sr-only"
            multiple
            onChange={(event) => onSelectUploadFiles(event.target.files)}
            required={selectedFiles.length === 0}
          />
        </div>
        <label className="grid gap-2 text-sm font-semibold text-foreground">
          Target Storage Account
          <select
            className="h-11 rounded-xl border border-border bg-white px-3 text-sm text-foreground"
            value={accountSelect.value}
            onChange={(event) => accountSelect.onChange(event.target.value)}
          >
            <option value="">Automatic (Default)</option>
            {accountSelect.accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.email || account.displayName || account.id} (
                {account.provider === "s3" ? "S3" : "Google Drive"})
              </option>
            ))}
          </select>
        </label>
        {folderSelect.activeFolder ? (
          <p className="rounded-xl bg-background-secondary p-3 text-sm text-muted">
            Uploading to:{" "}
            <b className="text-foreground">{folderSelect.activeFolder.name}</b>
          </p>
        ) : (
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Virtual Folder
            <select
              className="h-11 rounded-xl border border-border bg-white px-3 text-sm text-foreground"
              value={folderSelect.value}
              onChange={(event) => folderSelect.onChange(event.target.value)}
            >
              <option value="">No folder</option>
              {folderSelect.folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {selectedFiles.length > 0 ? (
          <div className="grid max-h-56 gap-2 overflow-y-auto rounded-xl bg-background-secondary p-3 text-sm text-muted">
            <div className="flex items-center justify-between gap-3">
              <span className="font-bold text-foreground">
                {selectedFiles.length} selected
              </span>
              <span className="shrink-0">
                {formatBytes(
                  selectedFiles.reduce((total, file) => total + file.size, 0),
                )}
              </span>
            </div>
            {selectedFiles.map((file, index) => (
              <div
                key={`${file.name}-${file.size}-${file.lastModified}`}
                className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-white px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate" title={file.name}>
                  {file.name}
                </span>
                <span className="shrink-0 text-xs text-muted">
                  {formatBytes(file.size)}
                </span>
                <button
                  type="button"
                  className="shrink-0 text-muted hover:text-danger"
                  onClick={() => onRemoveUploadFile(index)}
                  aria-label={`Remove ${file.name}`}
                >
                  <Xmark className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <div className="grid gap-3 sm:flex sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            isDisabled={loading}
            className={
              loading
                ? "border-border text-foreground opacity-50"
                : "border-border text-foreground"
            }
          >
            Cancel
          </Button>
          <Button
            type="submit"
            isDisabled={loading || selectedFiles.length === 0}
          >
            {loading
              ? "Uploading..."
              : `Upload${selectedFiles.length > 1 ? ` ${selectedFiles.length} files` : ""}`}
          </Button>
        </div>
      </form>
    </DummyModal>
  );
}
