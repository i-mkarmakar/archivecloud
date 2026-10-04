import { ArrowUpFromLine, Xmark } from "@gravity-ui/icons";
import { Button, Input } from "@heroui/react";
import type { DragEvent, FormEvent } from "react";
import {
  DummyModal,
  modalActionButtonClassName,
  modalActionsClassName,
} from "@/components/drive/DummyModal";
import type { FolderItem } from "@/data/drive-data";
import { formatBytes } from "@/lib/api";
import { providerLabel } from "@/lib/providers";
import { cn } from "@/lib/utils";
import type { ConnectedAccount } from "@/views/all-files/types";

export type UploadDestinationMode = "smart" | "manual";

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
    /** Ask Every Time: prompt Smart vs choose account on each upload. */
    askEveryTime?: boolean;
    destinationMode: UploadDestinationMode;
    onDestinationModeChange: (mode: UploadDestinationMode) => void;
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

  const askEveryTime = Boolean(accountSelect.askEveryTime);
  const showAccountSelect =
    !askEveryTime || accountSelect.destinationMode === "manual";

  return (
    <DummyModal
      open={open}
      title="Upload File"
      description="Stream files directly to your connected cloud accounts."
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
            Files stream to the cloud with the most available space, or the
            account you choose.
          </span>
          <Input
            type="file"
            className="sr-only"
            multiple
            onChange={(event) => onSelectUploadFiles(event.target.files)}
            required={selectedFiles.length === 0}
          />
        </div>

        {askEveryTime ? (
          <fieldset className="grid gap-2">
            <legend className="text-sm font-semibold text-foreground">
              Use Smart File Distribution for this upload?
            </legend>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm">
              <input
                type="radio"
                name="upload-destination"
                checked={accountSelect.destinationMode === "smart"}
                onChange={() => accountSelect.onDestinationModeChange("smart")}
              />
              <span className="font-semibold">
                Yes — Smart File Distribution
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm">
              <input
                type="radio"
                name="upload-destination"
                checked={accountSelect.destinationMode === "manual"}
                onChange={() => accountSelect.onDestinationModeChange("manual")}
              />
              <span className="font-semibold">No — Choose account</span>
            </label>
          </fieldset>
        ) : null}

        {showAccountSelect ? (
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Target Storage Account
            <select
              className="h-11 rounded-xl border border-border bg-white px-3 text-sm text-foreground"
              value={accountSelect.value}
              onChange={(event) => accountSelect.onChange(event.target.value)}
              required={
                askEveryTime && accountSelect.destinationMode === "manual"
              }
            >
              <option value="">
                {askEveryTime
                  ? "Select an account…"
                  : "Automatic (Smart File Distribution)"}
              </option>
              {accountSelect.accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.email || account.displayName || account.id} (
                  {providerLabel(account.provider)})
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="rounded-xl bg-background-secondary p-3 text-sm text-muted">
            Smart File Distribution will pick the connected cloud with the most
            available space for this upload.
          </p>
        )}

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
        <div className={modalActionsClassName}>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            isDisabled={loading}
            className={cn(
              modalActionButtonClassName,
              loading
                ? "border-border text-foreground opacity-50"
                : "border-border text-foreground",
            )}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className={modalActionButtonClassName}
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
