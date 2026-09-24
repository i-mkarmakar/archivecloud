"use client";

import {
  CircleInfo,
  Folder,
  FolderPlus,
  Picture,
  Plus,
} from "@gravity-ui/icons";
import { Button, Input, toast } from "@heroui/react";
import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { DummyModal } from "@/components/drive/DummyModal";
import { ActionTooltip } from "@/components/drive/ActionTooltip";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

const MAX_NAME_LENGTH = 100;
const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;
const ACCEPTED_THUMBNAIL_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

type VirtualFolderOption = {
  id: string;
  name: string;
  thumbnailDataUrl?: string | null;
  itemCount?: number;
};

export type AddToVirtualFolderTarget = {
  kind: "file" | "folder";
  name: string;
  connectedAccountId: string;
  providerItemId: string;
  mimeType?: string | null;
  sizeBytes?: string | number | null;
};

type Props = {
  open: boolean;
  target: AddToVirtualFolderTarget | null;
  onClose: () => void;
  onAdded?: () => void | Promise<void>;
};

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function AddToVirtualFolderModal({
  open,
  target,
  onClose,
  onAdded,
}: Props) {
  const [view, setView] = useState<"pick" | "create">("pick");
  const [folders, setFolders] = useState<VirtualFolderOption[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createThumbnail, setCreateThumbnail] = useState<string | null>(null);
  const [createThumbnailName, setCreateThumbnailName] = useState("");

  const nameValid = createName.trim().length > 0;
  const itemLabel = target?.kind === "folder" ? "folder" : "file";

  useEffect(() => {
    if (!open) {
      setView("pick");
      setFolders([]);
      setSelectedId("");
      setCreateName("");
      setCreateThumbnail(null);
      setCreateThumbnailName("");
      setLoading(false);
      setAdding(false);
      setCreating(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const data = await apiFetch<{ folders: VirtualFolderOption[] }>("/vf");
        if (cancelled) return;
        const list = data.folders ?? [];
        setFolders(list);
        setSelectedId(list[0]?.id ?? "");
      } catch (error) {
        if (!cancelled) {
          toast.danger(
            error instanceof Error
              ? error.message
              : "Failed to load virtual folders",
          );
          setFolders([]);
          setSelectedId("");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const canAdd = Boolean(target && selectedId && !adding && !loading);

  async function handleThumbnailFile(file: File | null) {
    if (!file) return;
    if (!ACCEPTED_THUMBNAIL_TYPES.has(file.type)) {
      toast.danger("Thumbnail must be PNG, JPG, or WEBP.");
      return;
    }
    if (file.size > MAX_THUMBNAIL_BYTES) {
      toast.danger("Thumbnail must be 5MB or smaller.");
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setCreateThumbnail(dataUrl);
      setCreateThumbnailName(file.name);
    } catch {
      toast.danger("Failed to read thumbnail.");
    }
  }

  async function handleCreate(event?: FormEvent) {
    event?.preventDefault();
    if (!nameValid) return;
    setCreating(true);
    try {
      const data = await apiFetch<{ folder: VirtualFolderOption }>("/vf", {
        method: "POST",
        body: JSON.stringify({
          name: createName.trim(),
          thumbnailDataUrl: createThumbnail,
        }),
      });
      toast.success("Virtual folder created");
      setFolders((current) => [...current, data.folder]);
      setSelectedId(data.folder.id);
      setCreateName("");
      setCreateThumbnail(null);
      setCreateThumbnailName("");
      setView("pick");
    } catch (error) {
      toast.danger(
        error instanceof Error
          ? error.message
          : "Failed to create virtual folder",
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleAdd() {
    if (!target || !selectedId) return;
    setAdding(true);
    try {
      await apiFetch(`/vf/${selectedId}/items`, {
        method: "POST",
        body: JSON.stringify({
          connectedAccountId: target.connectedAccountId,
          providerFileId: target.providerItemId,
          name: target.name,
          mimeType:
            target.mimeType ??
            (target.kind === "folder"
              ? "application/vnd.archivecloud.folder"
              : "application/octet-stream"),
          sizeBytes: target.sizeBytes ?? 0,
          kind: target.kind,
        }),
      });
      toast.success("Added to virtual folder");
      onClose();
      await onAdded?.();
    } catch (error) {
      toast.danger(
        error instanceof Error
          ? error.message
          : "Failed to add to virtual folder",
      );
    } finally {
      setAdding(false);
    }
  }

  const empty = !loading && folders.length === 0;

  const bannerText = useMemo(() => {
    const name = target?.name?.trim() || "this item";
    return `Adding '${name}' to a virtual folder. The original ${itemLabel} will remain in its cloud storage.`;
  }, [target?.name, itemLabel]);

  return (
    <DummyModal
      open={open}
      title={
        view === "create" ? "Create Virtual Folder" : "Add to Virtual Folder"
      }
      onClose={onClose}
      size="md"
    >
      {view === "create" ? (
        <form onSubmit={handleCreate} className="grid gap-5">
          <div className="flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-3 text-sm text-sky-900">
            <CircleInfo className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
            <span>
              Virtual folders organize links across clouds. Nothing is moved or
              copied from storage.
            </span>
          </div>

          <label
            htmlFor="add-vf-folder-name"
            className="grid gap-2 text-sm font-semibold"
          >
            <span>
              Folder name <span className="text-danger">*</span>
            </span>
            <Input
              id="add-vf-folder-name"
              fullWidth
              value={createName}
              maxLength={MAX_NAME_LENGTH}
              onChange={(event) => setCreateName(event.target.value)}
              placeholder="e.g. Project Assets"
              autoFocus
              required
            />
            <span className="text-xs font-normal text-muted">
              {createName.length}/{MAX_NAME_LENGTH} characters
            </span>
          </label>

          <div className="grid gap-2 text-sm font-semibold">
            <span>Folder Thumbnail (Optional)</span>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop upload target */}
            <div
              className="relative grid cursor-pointer gap-2 rounded-2xl border-2 border-dashed border-border bg-surface-secondary/40 px-4 py-8 text-center transition hover:border-primary/40"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files?.[0] ?? null;
                void handleThumbnailFile(file);
              }}
            >
              {createThumbnail ? (
                <img
                  src={createThumbnail}
                  alt=""
                  className="mx-auto h-24 w-24 rounded-xl object-cover"
                />
              ) : (
                <Picture className="mx-auto h-8 w-8 text-muted" />
              )}
              <p className="text-sm font-bold">
                {createThumbnailName || "Upload cover image"}
              </p>
              <p className="text-xs font-normal text-muted">
                PNG, JPG or WEBP up to 5MB
              </p>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="absolute inset-0 cursor-pointer opacity-0"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  void handleThumbnailFile(file);
                  event.target.value = "";
                }}
              />
            </div>
            {createThumbnail ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="justify-self-start"
                onPress={() => {
                  setCreateThumbnail(null);
                  setCreateThumbnailName("");
                }}
              >
                Remove thumbnail
              </Button>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <ActionTooltip label="Back to folder list">
              <Button
                type="button"
                variant="ghost"
                className="text-primary"
                onPress={() => setView("pick")}
                isDisabled={creating}
              >
                ← Back
              </Button>
            </ActionTooltip>
            <ActionTooltip label="Create virtual folder">
              <Button type="submit" isDisabled={!nameValid || creating}>
                {creating ? "Creating…" : "Create Virtual Folder"}
              </Button>
            </ActionTooltip>
          </div>
        </form>
      ) : (
        <div className="grid gap-5">
          <div className="flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-3 text-sm text-sky-900">
            <CircleInfo className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
            <span>{bannerText}</span>
          </div>

          {loading ? (
            <p className="py-10 text-center text-sm text-muted">
              Loading virtual folders…
            </p>
          ) : empty ? (
            <div className="grid justify-items-center gap-3 py-8 text-center">
              <Folder className="h-14 w-14 text-muted/50" />
              <div>
                <p className="text-sm font-extrabold text-foreground">
                  No virtual folders yet
                </p>
                <p className="mt-1 text-sm text-muted">
                  Create your first virtual folder to get started
                </p>
              </div>
              <ActionTooltip label="Create your first virtual folder">
                <button
                  type="button"
                  onClick={() => setView("create")}
                  className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                >
                  <FolderPlus className="h-4 w-4" />
                  Create Virtual Folder
                </button>
              </ActionTooltip>
            </div>
          ) : (
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-extrabold text-foreground">
                  Choose a virtual folder
                </p>
                <ActionTooltip label="Create a new virtual folder">
                  <button
                    type="button"
                    onClick={() => setView("create")}
                    className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    <FolderPlus className="h-3.5 w-3.5" />
                    New
                  </button>
                </ActionTooltip>
              </div>
              <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-xl border border-border p-1.5">
                {folders.map((folder) => {
                  const selected = folder.id === selectedId;
                  return (
                    <ActionTooltip
                      key={folder.id}
                      label={`Select “${folder.name}”`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedId(folder.id)}
                        className={cn(
                          "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition",
                          selected
                            ? "bg-primary/10 ring-1 ring-primary/30"
                            : "hover:bg-black/5",
                        )}
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-secondary">
                          {folder.thumbnailDataUrl ? (
                            <img
                              src={folder.thumbnailDataUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Folder className="h-5 w-5 text-primary" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {folder.name}
                          </p>
                          {typeof folder.itemCount === "number" ? (
                            <p className="text-xs text-muted">
                              {folder.itemCount}{" "}
                              {folder.itemCount === 1 ? "item" : "items"}
                            </p>
                          ) : null}
                        </div>
                      </button>
                    </ActionTooltip>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <ActionTooltip label="Cancel">
              <Button variant="outline" onPress={onClose} isDisabled={adding}>
                Cancel
              </Button>
            </ActionTooltip>
            <ActionTooltip
              label={
                empty
                  ? "Create a virtual folder first"
                  : "Add to selected virtual folder"
              }
            >
              <Button
                isDisabled={!canAdd || empty}
                onPress={() => void handleAdd()}
              >
                <Plus className="h-4 w-4" />
                {adding ? "Adding…" : "Add to Virtual Folder"}
              </Button>
            </ActionTooltip>
          </div>
        </div>
      )}
    </DummyModal>
  );
}
