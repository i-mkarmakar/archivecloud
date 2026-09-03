"use client";

import {
  ArrowLeft,
  File,
  Folder,
  FolderOpen,
  FolderPlus,
  Picture,
  Plus,
  TrashBin,
} from "@gravity-ui/icons";
import { Button, Card, Input, toast } from "@heroui/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  FileGridSkeleton,
  FileListSkeleton,
} from "@/components/drive/PageSkeletons";
import { DummyModal } from "@/components/drive/DummyModal";
import {
  FileViewToggle,
  type FileViewMode,
} from "@/components/drive/FileViewToggle";
import { PageHeader } from "@/components/drive/PageHeader";
import { useFileViewMode } from "@/hooks/useFileViewMode";
import { apiFetch, formatBytes, formatDate } from "@/lib/api";
import { isSupportedProviderId, providerLabel } from "@/lib/providers";
import { cn } from "@/lib/utils";

const MAX_NAME_LENGTH = 100;
const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;
const ACCEPTED_THUMBNAIL_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

type VirtualFolder = {
  id: string;
  name: string;
  color: string;
  thumbnailDataUrl: string | null;
  parentId: string | null;
  itemCount?: number;
  childCount?: number;
  createdAt: string;
};

type VirtualFolderItem = {
  id: string;
  name: string;
  providerFileId: string;
  providerFolderId: string | null;
  mimeType: string;
  sizeBytes: string;
  kind: string;
  connectedAccountId: string;
  createdAt: string;
  connectedAccount?: {
    id: string;
    email: string;
    provider: string;
    displayName: string | null;
  };
};

type ConnectedAccount = {
  id: string;
  email: string;
  displayName?: string | null;
  provider: string;
};

type BrowseFolder = { id: string; name: string; modifiedTime?: string };
type BrowseFile = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: string;
  modifiedTime?: string;
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Failed to read image"));
    };
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
}

function groupItemsByDay(items: VirtualFolderItem[]) {
  const groups = new Map<string, VirtualFolderItem[]>();
  for (const item of items) {
    const day = formatDate(item.createdAt).split(",")[0] ?? item.createdAt;
    const list = groups.get(day) ?? [];
    list.push(item);
    groups.set(day, list);
  }
  return [...groups.entries()];
}

export function VirtualFoldersPage() {
  const [folders, setFolders] = useState<VirtualFolder[]>([]);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(
    null,
  );
  const [items, setItems] = useState<VirtualFolderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useFileViewMode(
    "archivecloud:vf-view",
    "grid",
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createThumbnail, setCreateThumbnail] = useState<string | null>(null);
  const [createThumbnailName, setCreateThumbnailName] = useState("");
  const [creating, setCreating] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addAccountId, setAddAccountId] = useState("");
  const [browseParentId, setBrowseParentId] = useState("root");
  const [browseFolders, setBrowseFolders] = useState<BrowseFolder[]>([]);
  const [browseFiles, setBrowseFiles] = useState<BrowseFile[]>([]);
  const [browseTrail, setBrowseTrail] = useState<
    { id: string; name: string }[]
  >([{ id: "root", name: "Root" }]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [addingItemId, setAddingItemId] = useState<string | null>(null);

  const selectedFolder = useMemo(
    () => folders.find((folder) => folder.id === selectedFolderId) ?? null,
    [folders, selectedFolderId],
  );

  const rootFolders = useMemo(
    () => folders.filter((folder) => !folder.parentId),
    [folders],
  );

  const nameValid =
    createName.trim().length > 0 && createName.trim().length <= MAX_NAME_LENGTH;

  const loadFolders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [foldersData, accountsData] = await Promise.all([
        apiFetch<{ folders: VirtualFolder[] }>("/vf"),
        apiFetch<{ accounts: ConnectedAccount[] }>("/connected-accounts"),
      ]);
      setFolders(foldersData.folders);
      const supported = accountsData.accounts.filter((account) =>
        isSupportedProviderId(account.provider),
      );
      setAccounts(supported);
      setAddAccountId((current) => current || supported[0]?.id || "");
      setSelectedFolderId((current) => {
        if (current && foldersData.folders.some((f) => f.id === current)) {
          return current;
        }
        return null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load folders");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadItems = useCallback(async (folderId: string) => {
    setItemsLoading(true);
    try {
      const data = await apiFetch<{ items: VirtualFolderItem[] }>(
        `/vf/${folderId}/items`,
      );
      setItems(data.items);
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : "Failed to load items");
      setItems([]);
    } finally {
      setItemsLoading(false);
    }
  }, []);

  const loadBrowse = useCallback(
    async (accountId: string, parentId: string) => {
      if (!accountId) return;
      setBrowseLoading(true);
      try {
        const params = new URLSearchParams({ parentId });
        const data = await apiFetch<{
          folders: BrowseFolder[];
          files: BrowseFile[];
        }>(`/connected-accounts/${accountId}/browse?${params}`);
        setBrowseFolders(data.folders);
        setBrowseFiles(data.files);
      } catch (err) {
        toast.danger(err instanceof Error ? err.message : "Browse failed");
        setBrowseFolders([]);
        setBrowseFiles([]);
      } finally {
        setBrowseLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadFolders().catch(() => undefined);
  }, [loadFolders]);

  useEffect(() => {
    if (!selectedFolderId) {
      setItems([]);
      return;
    }
    loadItems(selectedFolderId).catch(() => undefined);
  }, [selectedFolderId, loadItems]);

  function resetCreateForm() {
    setCreateName("");
    setCreateThumbnail(null);
    setCreateThumbnailName("");
  }

  function openCreateModal() {
    resetCreateForm();
    setCreateOpen(true);
  }

  function closeCreateModal() {
    if (creating) return;
    setCreateOpen(false);
    resetCreateForm();
  }

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

  async function createFolder(event: FormEvent) {
    event.preventDefault();
    if (!nameValid) return;
    setCreating(true);
    try {
      const data = await apiFetch<{ folder: VirtualFolder }>("/vf", {
        method: "POST",
        body: JSON.stringify({
          name: createName.trim(),
          thumbnailDataUrl: createThumbnail,
        }),
      });
      toast.success("Virtual folder created");
      setFolders((current) => [...current, data.folder]);
      setSelectedFolderId(data.folder.id);
      setCreateOpen(false);
      resetCreateForm();
    } catch (err) {
      toast.danger(
        err instanceof Error ? err.message : "Failed to create folder",
      );
    } finally {
      setCreating(false);
    }
  }

  async function deleteFolder(folderId: string, folderName: string) {
    if (
      !window.confirm(
        `Delete virtual folder “${folderName}” and all nested folders/items?`,
      )
    ) {
      return;
    }
    try {
      await apiFetch(`/vf/${folderId}`, { method: "DELETE" });
      toast.success("Virtual folder deleted");
      setFolders((current) => current.filter((folder) => folder.id !== folderId));
      if (selectedFolderId === folderId) {
        setSelectedFolderId(null);
      }
    } catch (err) {
      toast.danger(
        err instanceof Error ? err.message : "Failed to delete folder",
      );
    }
  }

  function openAddModal() {
    if (!accounts.length) {
      toast.danger("Connect a cloud account first.");
      return;
    }
    const accountId = addAccountId || accounts[0]?.id || "";
    setAddAccountId(accountId);
    setBrowseParentId("root");
    setBrowseTrail([{ id: "root", name: "Root" }]);
    setAddOpen(true);
    loadBrowse(accountId, "root").catch(() => undefined);
  }

  function enterBrowseFolder(folder: BrowseFolder) {
    setBrowseParentId(folder.id);
    setBrowseTrail((trail) => [...trail, { id: folder.id, name: folder.name }]);
    loadBrowse(addAccountId, folder.id).catch(() => undefined);
  }

  function jumpBrowseTrail(index: number) {
    const next = browseTrail.slice(0, index + 1);
    const target = next[next.length - 1];
    if (!target) return;
    setBrowseTrail(next);
    setBrowseParentId(target.id);
    loadBrowse(addAccountId, target.id).catch(() => undefined);
  }

  async function addBrowseFile(file: BrowseFile) {
    if (!selectedFolderId || !addAccountId) return;
    setAddingItemId(file.id);
    try {
      await apiFetch(`/vf/${selectedFolderId}/items`, {
        method: "POST",
        body: JSON.stringify({
          connectedAccountId: addAccountId,
          providerFileId: file.id,
          providerFolderId:
            browseParentId === "root" ? undefined : browseParentId,
          name: file.name,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          kind: "file",
        }),
      });
      toast.success(`Added “${file.name}”`);
      await loadItems(selectedFolderId);
      await loadFolders();
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : "Failed to add item");
    } finally {
      setAddingItemId(null);
    }
  }

  async function removeItem(itemId: string) {
    if (!selectedFolderId) return;
    try {
      await apiFetch(`/vf/items/${itemId}`, { method: "DELETE" });
      toast.success("Removed from virtual folder (original file unchanged)");
      await loadItems(selectedFolderId);
      await loadFolders();
    } catch (err) {
      toast.danger(
        err instanceof Error ? err.message : "Failed to remove item",
      );
    }
  }

  function providerFileUrl(
    accountId: string,
    fileId: string,
    kind: "preview" | "download",
  ) {
    return `/connected-accounts/${accountId}/files/${encodeURIComponent(fileId)}/${kind}`;
  }

  function renderFolderCard(folder: VirtualFolder) {
    const selected = folder.id === selectedFolderId;
    return (
      <div
        key={folder.id}
        className={cn(
          "group relative overflow-hidden rounded-2xl border bg-surface text-left transition",
          selected
            ? "border-accent ring-2 ring-accent/30"
            : "border-border hover:border-accent/40",
        )}
      >
        <button
          type="button"
          className="block w-full text-left"
          onClick={() => setSelectedFolderId(folder.id)}
        >
          <div className="flex h-28 items-center justify-center bg-surface-secondary">
            {folder.thumbnailDataUrl ? (
              // biome-ignore lint/performance/noImgElement: user-uploaded data URL thumbnail
              <img
                src={folder.thumbnailDataUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <FolderOpen
                className="h-10 w-10"
                style={{ color: folder.color || "#1e9df1" }}
              />
            )}
          </div>
          <div className="p-3">
            <p className="truncate font-bold">{folder.name}</p>
            <p className="mt-0.5 text-xs text-muted">
              {folder.itemCount ?? 0}{" "}
              {(folder.itemCount ?? 0) === 1 ? "item" : "items"}
            </p>
          </div>
        </button>
        <Button
          size="sm"
          variant="ghost"
          className="absolute top-2 right-2 opacity-0 transition group-hover:opacity-100"
          aria-label={`Delete ${folder.name}`}
          onClick={() => deleteFolder(folder.id, folder.name)}
        >
          <TrashBin className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  function renderItemRow(item: VirtualFolderItem) {
    return (
      <div
        key={item.id}
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-secondary"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{item.name}</p>
          <p className="text-xs text-muted">
            {item.connectedAccount
              ? providerLabel(item.connectedAccount.provider)
              : "Cloud"}{" "}
            · {formatBytes(item.sizeBytes)} · {formatDate(item.createdAt)}
          </p>
        </div>
        <a
          className="text-xs font-semibold text-accent hover:underline"
          href={providerFileUrl(
            item.connectedAccountId,
            item.providerFileId,
            "preview",
          )}
          target="_blank"
          rel="noreferrer"
        >
          Open
        </a>
        <a
          className="text-xs font-semibold text-accent hover:underline"
          href={providerFileUrl(
            item.connectedAccountId,
            item.providerFileId,
            "download",
          )}
        >
          Download
        </a>
        <Button size="sm" variant="ghost" onClick={() => removeItem(item.id)}>
          Remove
        </Button>
      </div>
    );
  }

  function renderItems(mode: FileViewMode) {
    if (itemsLoading) {
      return (
        <FileGridSkeleton className="mt-6" count={6} label="Loading items" />
      );
    }
    if (items.length === 0) {
      return (
        <div className="mt-6 rounded-2xl border border-dashed border-border px-6 py-10 text-center">
          <p className="font-bold">No files in this collection yet</p>
          <p className="mt-2 text-sm text-muted">
            Add files from any connected cloud. Originals stay where they are.
          </p>
          <Button className="mt-4" onClick={openAddModal}>
            <Plus className="h-4 w-4" />
            Add files from cloud
          </Button>
        </div>
      );
    }

    if (mode === "grid") {
      return (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <Card key={item.id} className="p-4">
              <p className="truncate font-bold">{item.name}</p>
              <p className="mt-1 text-xs text-muted">
                {item.connectedAccount
                  ? providerLabel(item.connectedAccount.provider)
                  : "Cloud"}{" "}
                · {formatBytes(item.sizeBytes)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    window.open(
                      providerFileUrl(
                        item.connectedAccountId,
                        item.providerFileId,
                        "preview",
                      ),
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }
                >
                  Open
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeItem(item.id)}
                >
                  Remove
                </Button>
              </div>
            </Card>
          ))}
        </div>
      );
    }

    if (mode === "calendar") {
      return (
        <div className="mt-4 grid gap-4">
          {groupItemsByDay(items).map(([day, dayItems]) => (
            <div key={day}>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                Added {day}
              </p>
              <div className="grid gap-1">{dayItems.map(renderItemRow)}</div>
            </div>
          ))}
        </div>
      );
    }

    return <div className="mt-4 grid gap-1">{items.map(renderItemRow)}</div>;
  }

  return (
    <>
      <PageHeader
        title={
          selectedFolder ? (
            <span className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg p-1 text-muted hover:bg-surface-secondary hover:text-foreground"
                aria-label="Back to virtual folders"
                onClick={() => setSelectedFolderId(null)}
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              {selectedFolder.name}
            </span>
          ) : (
            "Virtual Folders"
          )
        }
        description={
          selectedFolder
            ? "References only. Files stay on their original clouds."
            : "Smart collections that group files across clouds without moving them."
        }
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {!selectedFolder && rootFolders.length > 0 ? (
              <FileViewToggle mode={viewMode} onChange={setViewMode} />
            ) : null}
            {selectedFolder ? (
              <>
                <FileViewToggle mode={viewMode} onChange={setViewMode} />
                <Button onClick={openAddModal}>
                  <Plus className="h-4 w-4" />
                  Add files
                </Button>
              </>
            ) : (
              <Button onClick={openCreateModal}>
                <FolderPlus className="h-4 w-4" />
                Create Virtual Folder
              </Button>
            )}
          </div>
        }
      />

      {loading ? (
        <FileListSkeleton
          className="mt-6"
          count={5}
          label="Loading virtual folders"
        />
      ) : null}
      {error ? <p className="mt-6 text-sm text-danger">{error}</p> : null}

      {!loading && !selectedFolder && folders.length === 0 ? (
        <Card className="mt-6 px-6 py-12 text-center sm:px-10">
          <Folder className="mx-auto h-10 w-10 text-accent" />
          <p className="mt-4 text-xl font-extrabold tracking-tight">
            Virtual Folders
          </p>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted">
            Virtual folders are smart collections. Add files from different cloud
            accounts and folders into one view, without moving, duplicating, or
            modifying the originals.
          </p>
          <ul className="mx-auto mt-5 max-w-md space-y-2 text-left text-sm text-muted">
            <li>• Group project files scattered across Google Drive, Dropbox, OneDrive, and more</li>
            <li>• Organize photos and documents by topic, not by storage location</li>
            <li>• Build custom views for faster browsing</li>
          </ul>
          <Button className="mx-auto mt-8" onClick={openCreateModal}>
            <FolderPlus className="h-4 w-4" />
            Create Virtual Folder
          </Button>
        </Card>
      ) : null}

      {!loading && !selectedFolder && rootFolders.length > 0 ? (
        <div className="mt-6">
          {viewMode === "list" ? (
            <div className="grid gap-1">
              {rootFolders.map((folder) => (
                <div
                  key={folder.id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-secondary"
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    onClick={() => setSelectedFolderId(folder.id)}
                  >
                    {folder.thumbnailDataUrl ? (
                      // biome-ignore lint/performance/noImgElement: user-uploaded data URL thumbnail
                      <img
                        src={folder.thumbnailDataUrl}
                        alt=""
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                    ) : (
                      <FolderOpen
                        className="h-5 w-5 shrink-0"
                        style={{ color: folder.color || "#1e9df1" }}
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      {folder.name}
                    </span>
                    <span className="text-xs text-muted">
                      {folder.itemCount ?? 0} items ·{" "}
                      {formatDate(folder.createdAt)}
                    </span>
                  </button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Delete ${folder.name}`}
                    onClick={() => deleteFolder(folder.id, folder.name)}
                  >
                    <TrashBin className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : viewMode === "calendar" ? (
            <div className="grid gap-4">
              {groupItemsByDay(
                rootFolders.map((folder) => ({
                  id: folder.id,
                  name: folder.name,
                  providerFileId: folder.id,
                  providerFolderId: null,
                  mimeType: "folder",
                  sizeBytes: String(folder.itemCount ?? 0),
                  kind: "folder",
                  connectedAccountId: "",
                  createdAt: folder.createdAt,
                })),
              ).map(([day, dayFolders]) => (
                <div key={day}>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                    Created {day}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {dayFolders.map((placeholder) => {
                      const folder = rootFolders.find(
                        (f) => f.id === placeholder.id,
                      );
                      return folder ? renderFolderCard(folder) : null;
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {rootFolders.map(renderFolderCard)}
            </div>
          )}
        </div>
      ) : null}

      {!loading && selectedFolder ? (
        <div className="mt-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">
              {items.length}{" "}
              {items.length === 1 ? "reference" : "references"} · remove only
              unlinks from this collection
            </p>
            <Button
              size="sm"
              variant="ghost"
              className="text-danger"
              onClick={() =>
                deleteFolder(selectedFolder.id, selectedFolder.name)
              }
            >
              <TrashBin className="h-4 w-4" />
              Delete folder
            </Button>
          </div>
          {renderItems(viewMode)}
        </div>
      ) : null}

      <DummyModal
        open={createOpen}
        title="Create Virtual Folder"
        description="Create a new virtual folder to organize your files across different cloud storage accounts."
        onClose={closeCreateModal}
      >
        <form onSubmit={createFolder} className="grid gap-5">
          <label className="grid gap-2 text-sm font-semibold">
            <span>
              Folder name <span className="text-danger">*</span>
            </span>
            <Input
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
              className="relative grid cursor-pointer gap-2 rounded-2xl border-2 border-dashed border-border bg-surface-secondary/40 px-4 py-8 text-center transition hover:border-accent/50"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files?.[0] ?? null;
                handleThumbnailFile(file).catch(() => undefined);
              }}
            >
              {createThumbnail ? (
                // biome-ignore lint/performance/noImgElement: user-uploaded data URL thumbnail
                <img
                  src={createThumbnail}
                  alt=""
                  className="mx-auto h-24 w-24 rounded-xl object-cover"
                />
              ) : (
                <Picture className="mx-auto h-8 w-8 text-muted" />
              )}
              <p className="text-sm font-bold">
                {createThumbnailName || "Click to upload or drag and drop"}
              </p>
              <p className="text-xs font-normal text-muted">
                PNG, JPG or WEBP (MAX. 5MB)
              </p>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="absolute inset-0 cursor-pointer opacity-0"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  handleThumbnailFile(file).catch(() => undefined);
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
                onClick={() => {
                  setCreateThumbnail(null);
                  setCreateThumbnailName("");
                }}
              >
                Remove thumbnail
              </Button>
            ) : null}
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={closeCreateModal}
              isDisabled={creating}
            >
              Cancel
            </Button>
            <Button type="submit" isDisabled={!nameValid || creating}>
              {creating ? "Creating…" : "Create Virtual Folder"}
            </Button>
          </div>
        </form>
      </DummyModal>

      <DummyModal
        open={addOpen}
        title="Add files from cloud"
        description="Pick files from a connected account. They are linked into this collection. Nothing is moved or copied."
        onClose={() => setAddOpen(false)}
        className="sm:max-w-2xl"
      >
        <div className="grid gap-4">
          <label className="grid gap-2 text-sm font-semibold">
            Connected account
            <select
              className="h-11 rounded-xl border border-border bg-white px-3 text-sm"
              value={addAccountId}
              onChange={(event) => {
                const next = event.target.value;
                setAddAccountId(next);
                setBrowseParentId("root");
                setBrowseTrail([{ id: "root", name: "Root" }]);
                loadBrowse(next, "root").catch(() => undefined);
              }}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {providerLabel(account.provider)} ·{" "}
                  {account.displayName || account.email}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap items-center gap-1 text-xs text-muted">
            {browseTrail.map((crumb, index) => (
              <span key={`${crumb.id}-${index}`} className="flex items-center gap-1">
                {index > 0 ? <span>/</span> : null}
                <button
                  type="button"
                  className="rounded px-1 py-0.5 hover:bg-surface-secondary hover:text-foreground"
                  onClick={() => jumpBrowseTrail(index)}
                >
                  {crumb.name}
                </button>
              </span>
            ))}
          </div>

          {browseLoading ? (
            <FileListSkeleton count={6} label="Loading browse" />
          ) : (
            <div className="max-h-80 overflow-y-auto rounded-xl border border-border">
              {browseFolders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  className="flex w-full items-center gap-2 border-b border-border px-3 py-2.5 text-left text-sm hover:bg-surface-secondary"
                  onClick={() => enterBrowseFolder(folder)}
                >
                  <Folder className="h-4 w-4 text-accent" />
                  <span className="truncate font-semibold">{folder.name}</span>
                </button>
              ))}
              {browseFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-2 border-b border-border px-3 py-2.5 last:border-b-0"
                >
                  <File className="h-4 w-4 shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{file.name}</p>
                    <p className="text-xs text-muted">
                      {formatBytes(file.sizeBytes)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    isDisabled={addingItemId === file.id}
                    onClick={() => addBrowseFile(file)}
                  >
                    {addingItemId === file.id ? "Adding…" : "Add"}
                  </Button>
                </div>
              ))}
              {!browseFolders.length && !browseFiles.length ? (
                <p className="px-3 py-8 text-center text-sm text-muted">
                  This folder is empty.
                </p>
              ) : null}
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </DummyModal>
    </>
  );
}
