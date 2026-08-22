"use client";
import {
  ArrowDownToLine,
  ArrowRotateRight,
  ArrowUpFromLine,
  ChevronsExpandVertical,
  CircleCheck,
  CopyCheck,
  EllipsisVertical,
  FolderArrowRight,
  FolderPlus,
  Link,
  PersonPlus,
  Sliders,
  TrashBin,
  Xmark,
} from "@gravity-ui/icons";
import { Button, Input, Popover, Skeleton, toast } from "@heroui/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  type DragEvent,
  type FormEvent,
  type MouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  NoConnectedAccountsEmptyState,
  NoConnectedAccountsEmptyStateSkeleton,
} from "@/components/dashboard/NoConnectedAccountsEmptyState";
import {
  SIDEBAR_CREATE_EVENT,
  type SidebarCreateAction,
} from "@/components/dashboard/SidebarNewButton";
import { DummyModal } from "@/components/drive/DummyModal";
import { EmptyAreaContextMenu } from "@/components/drive/EmptyAreaContextMenu";
import { FileContextMenu } from "@/components/drive/FileContextMenu";
import { FileDetailsDrawer } from "@/components/drive/FileDetailsDrawer";
import { FileGrid } from "@/components/drive/FileGrid";
import { FileTable } from "@/components/drive/FileTable";
import { FileViewToggle } from "@/components/drive/FileViewToggle";
import { FolderContextMenu } from "@/components/drive/FolderContextMenu";
import { FolderGrid } from "@/components/drive/FolderGrid";
import {
  defaultFolderColor,
  folderColorOptions,
  normalizeFolderColor,
} from "@/components/drive/folder-colors";
import { ImageLightbox } from "@/components/drive/ImageLightbox";
import { PageHeader } from "@/components/drive/PageHeader";
import { SuggestedSection } from "@/components/drive/SuggestedSection";
import { ProviderBrandIcon } from "@/components/ProviderBrandIcon";
import { useUpload } from "@/context/UploadContext";
import type { FileItem, FolderItem } from "@/data/drive-data";
import { useFileViewMode } from "@/hooks/useFileViewMode";
import { updateFilesMetadata } from "@/hooks/useWorkspaceFiles";
import {
  API_URL,
  apiFetch,
  formatBytes,
  formatDate,
  isAbortError,
  isNetworkError,
} from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { type ApiFile, mapApiFileToItem } from "@/lib/files";
import { getFirstName, getTimeGreeting } from "@/lib/greeting";
import { createPlyr, ensurePlyr } from "@/lib/plyr";
import { getPreviewKind, officeViewerUrl } from "@/lib/preview";
import { providerLabel } from "@/lib/providers";
import { cn } from "@/lib/utils";

type BackendFile = ApiFile;
type BackendFolder = {
  id: string;
  name: string;
  color: string;
  parentId?: string | null;
  providerFolderId?: string | null;
  updatedAt: string;
};
type ConnectedAccount = {
  id: string;
  provider: string;
  email: string;
  displayName?: string | null;
  status: string;
};

type FileSort =
  | "created_desc"
  | "created_asc"
  | "name_asc"
  | "name_desc"
  | "size_desc"
  | "updated_desc";

const FILE_SORT_OPTIONS: { value: FileSort; label: string }[] = [
  { value: "created_desc", label: "Created (Newest)" },
  { value: "created_asc", label: "Created (Oldest)" },
  { value: "updated_desc", label: "Modified (Newest)" },
  { value: "name_asc", label: "Name (A–Z)" },
  { value: "name_desc", label: "Name (Z–A)" },
  { value: "size_desc", label: "Size (Largest)" },
];

function AccountProviderIcon({ provider }: { provider: string }) {
  return (
    <ProviderBrandIcon
      name={provider}
      className="h-5 w-5 shrink-0"
      fallback={
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-[10px] font-bold text-primary">
          {providerLabel(provider).charAt(0)}
        </span>
      }
    />
  );
}

function accountTitle(account: ConnectedAccount) {
  const name = account.displayName?.trim();
  if (name) return name;
  return `My ${providerLabel(account.provider)}`;
}

function mapFile(file: BackendFile): FileItem {
  return mapApiFileToItem(file);
}

function mapFolder(folder: BackendFolder): FolderItem {
  return {
    id: folder.id,
    name: folder.name,
    color: folder.color,
    parentId: folder.parentId,
    providerFolderId: folder.providerFolderId,
    updated: `Updated ${formatDate(folder.updatedAt)}`,
  };
}

function FolderColorFields({
  color,
  onColorChange,
}: {
  color: string;
  onColorChange: (color: string) => void;
}) {
  const normalizedColor = normalizeFolderColor(color);
  return (
    <div className="grid gap-4">
      <div className="grid gap-2 text-sm font-semibold">
        Folder Color
        <Input
          type="color"
          value={normalizedColor}
          onChange={(event) => onColorChange(event.target.value)}
          className="h-12 p-1"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {folderColorOptions.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onColorChange(option)}
            className={
              normalizedColor === option
                ? "h-8 w-8 rounded-lg border-2 border-border"
                : "h-8 w-8 rounded-lg border border-border"
            }
            style={{ backgroundColor: option }}
            aria-label={`Use ${option} folder color`}
          />
        ))}
      </div>
    </div>
  );
}

export function AllFilesPage() {
  const sp = useSearchParams() ?? new URLSearchParams();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const activeFolderId = sp.get("folderId");
  const searchQuery = sp.get("q")?.trim() ?? "";
  const filterAccountId = sp.get("accountId")?.trim() ?? "";
  const sortParam = (sp.get("sort") as FileSort | null) ?? "created_desc";
  const activeSort = FILE_SORT_OPTIONS.some(
    (option) => option.value === sortParam,
  )
    ? sortParam
    : "created_desc";

  function patchHomeParams(patch: Record<string, string | null | undefined>) {
    const next = new URLSearchParams(sp.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    const qs = next.toString();
    router.push(qs ? `/home?${qs}` : "/home");
  }

  function setFolderSearchParams(params: Record<string, string>) {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) next.set(key, value);
    }
    if (filterAccountId) next.set("accountId", filterAccountId);
    if (activeSort && activeSort !== "created_desc")
      next.set("sort", activeSort);
    const qs = next.toString();
    router.push(qs ? `/home?${qs}` : "/home");
  }
  const [uploadOpen, setUploadOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [folderRenameOpen, setFolderRenameOpen] = useState(false);
  const [folderDeleteOpen, setFolderDeleteOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [allFolders, setAllFolders] = useState<FolderItem[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [isUploadDragging, setIsUploadDragging] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderColor, setFolderColor] = useState(defaultFolderColor);
  const [renameValue, setRenameValue] = useState("");
  const [folderRenameValue, setFolderRenameValue] = useState("");
  const [folderRenameColor, setFolderRenameColor] =
    useState(defaultFolderColor);
  const [activeFile, setActiveFile] = useState<FileItem | null>(null);
  const [activeFolderForMenu, setActiveFolderForMenu] =
    useState<FolderItem | null>(null);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(
    new Set(),
  );
  const [suggestedFoldersOpen, setSuggestedFoldersOpen] = useState(true);
  const [suggestedFilesOpen, setSuggestedFilesOpen] = useState(true);
  const [cutFolder, setCutFolder] = useState<FolderItem | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    file: FileItem | null;
  }>({ x: 0, y: 0, file: null });
  const [folderContextMenu, setFolderContextMenu] = useState<{
    x: number;
    y: number;
    folder: FolderItem | null;
  }>({ x: 0, y: 0, folder: null });
  const [emptyContextMenu, setEmptyContextMenu] = useState<{
    x: number;
    y: number;
    open: boolean;
  }>({ x: 0, y: 0, open: false });
  const [gdrivePublicUrl, setGdrivePublicUrl] = useState("");
  const [makingPublic, setMakingPublic] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncingDrive, setSyncingDrive] = useState(false);
  const [fileViewMode, changeFileViewMode] = useFileViewMode(
    "archivecloud:all-files-view-mode",
  );
  const { uploadFiles } = useUpload();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [inviteTargetType, setInviteTargetType] = useState<"file" | "folder">(
    "file",
  );
  const [inviteTargetId, setInviteTargetId] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviting, setInviting] = useState(false);
  const [virtualFolders, setVirtualFolders] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [virtualFolderId, setVirtualFolderId] = useState("");
  const [virtualFolderOpen, setVirtualFolderOpen] = useState(false);
  const [addingToVirtual, setAddingToVirtual] = useState(false);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const [connectedAccounts, setConnectedAccounts] = useState<
    ConnectedAccount[]
  >([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [selectedTargetAccountId, setSelectedTargetAccountId] = useState("");

  async function loadFiles() {
    const params = new URLSearchParams();
    if (activeFolderId) params.set("folderId", activeFolderId);
    if (searchQuery) params.set("q", searchQuery);

    const kind = sp.get("kind");
    const tagId = sp.get("tagId");
    const minSize = sp.get("minSize");
    const maxSize = sp.get("maxSize");
    const startDate = sp.get("startDate");
    const endDate = sp.get("endDate");

    if (kind) params.set("kind", kind);
    if (filterAccountId) params.set("accountId", filterAccountId);
    if (tagId) params.set("tagId", tagId);
    if (minSize) params.set("minSize", minSize);
    if (maxSize) params.set("maxSize", maxSize);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (activeSort) params.set("sort", activeSort);

    const query = params.toString();
    const path = query ? `/files?${query}` : "/files";
    const data = await apiFetch<{ files: BackendFile[] }>(path);
    setFiles(data.files.map(mapFile));
  }

  async function loadFolders() {
    const folderParams = new URLSearchParams();
    if (activeFolderId) folderParams.set("parentId", activeFolderId);
    if (filterAccountId) folderParams.set("accountId", filterAccountId);
    const visibleQuery = folderParams.toString();
    const visiblePath = visibleQuery ? `/folders?${visibleQuery}` : "/folders";

    const allParams = new URLSearchParams({ all: "1" });
    if (filterAccountId) allParams.set("accountId", filterAccountId);
    const allPath = `/folders?${allParams.toString()}`;

    const [visibleData, allData] = await Promise.all([
      apiFetch<{ folders: BackendFolder[] }>(visiblePath),
      apiFetch<{ folders: BackendFolder[] }>(allPath),
    ]);
    setFolders(visibleData.folders.map(mapFolder));
    setAllFolders(allData.folders.map(mapFolder));
  }

  async function loadAll() {
    await Promise.all([loadFiles(), loadFolders()]);
  }

  async function handleDropItem(fileId: string, targetFolderId: string) {
    const fileIds = selectedFileIds.has(fileId)
      ? Array.from(selectedFileIds)
      : [fileId];
    setLoading(true);
    try {
      await apiFetch("/files/batch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds, folderId: targetFolderId }),
      });
      toast.success(`Successfully moved ${fileIds.length} item(s).`);
      loadAll().catch(() => undefined);
      setSelectedFileIds(new Set());
    } catch (error) {
      toast.danger(
        error instanceof Error ? error.message : "Failed to move items",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    const AUTO_SYNC_COOLDOWN_MS = 5 * 60 * 1000;
    const AUTO_SYNC_STORAGE_KEY = "archivecloud:last-drive-auto-sync";

    async function loadConnectedAccountsAndSync() {
      try {
        const data = await apiFetch<{ accounts: ConnectedAccount[] }>(
          "/connected-accounts",
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        const accounts = data.accounts || [];
        setConnectedAccounts(accounts);
        setAccountsLoaded(true);

        const hasGoogleDrive = accounts.some(
          (account) =>
            account.provider === "google_drive" &&
            account.status === "connected",
        );
        if (!hasGoogleDrive) return;

        const lastSyncAt = Number(
          sessionStorage.getItem(AUTO_SYNC_STORAGE_KEY) ?? "0",
        );
        if (
          Number.isFinite(lastSyncAt) &&
          Date.now() - lastSyncAt < AUTO_SYNC_COOLDOWN_MS
        ) {
          return;
        }

        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 750);
        });
        if (controller.signal.aborted) return;

        setSyncingDrive(true);
        try {
          const response = await apiFetch<{
            results: { created: number; updated: number; deleted: number }[];
          }>("/files/sync-google", {
            method: "POST",
            body: JSON.stringify({}),
            signal: controller.signal,
          });
          if (controller.signal.aborted) return;

          sessionStorage.setItem(AUTO_SYNC_STORAGE_KEY, String(Date.now()));

          let created = 0;
          for (const res of response.results) created += res.created;
          await loadAll();
          window.dispatchEvent(new Event("archivecloud:storage-changed"));
          if (created > 0) {
            toast.success(
              `Imported ${created} file${created === 1 ? "" : "s"} from Google Drive.`,
            );
          }
        } catch (error) {
          if (isAbortError(error)) return;
          if (isNetworkError(error)) {
            console.warn("Auto sync Google Drive skipped (network).");
            return;
          }
          console.warn("Auto sync Google Drive failed:", error);
        } finally {
          if (!controller.signal.aborted) setSyncingDrive(false);
        }
      } catch (error) {
        if (isAbortError(error)) return;
        setAccountsLoaded(true);
        console.warn("Failed to load connected accounts:", error);
      }
    }

    async function refreshConnectedAccounts() {
      try {
        const data = await apiFetch<{ accounts: ConnectedAccount[] }>(
          "/connected-accounts",
        );
        setConnectedAccounts(data.accounts || []);
        setAccountsLoaded(true);
      } catch (error) {
        console.warn("Failed to refresh connected accounts:", error);
      }
    }

    function onStorageChanged() {
      void refreshConnectedAccounts();
    }

    window.addEventListener("archivecloud:storage-changed", onStorageChanged);
    void loadConnectedAccountsAndSync();
    return () => {
      controller.abort();
      window.removeEventListener(
        "archivecloud:storage-changed",
        onStorageChanged,
      );
    };
  }, []);

  useEffect(() => {
    loadAll().catch((error) =>
      toast.danger(
        error instanceof Error ? error.message : "Failed to load files",
      ),
    );
    setSelectedFileIds(new Set());
  }, [activeFolderId, searchQuery, filterAccountId, activeSort]);

  const selectedAccount = useMemo(
    () => connectedAccounts.find((account) => account.id === filterAccountId),
    [connectedAccounts, filterAccountId],
  );
  const activeSortLabel =
    FILE_SORT_OPTIONS.find((option) => option.value === activeSort)?.label ??
    "Created (Newest)";

  const filesByDay = useMemo(() => {
    const groups = new Map<string, FileItem[]>();
    for (const file of files) {
      const key = formatDate(
        file.updatedAt ?? file.createdAt ?? new Date().toISOString(),
      );
      const list = groups.get(key) ?? [];
      list.push(file);
      groups.set(key, list);
    }
    return Array.from(groups.entries());
  }, [files]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setContextMenu({ x: 0, y: 0, file: null });
      if (event.key === "Escape")
        setFolderContextMenu({ x: 0, y: 0, folder: null });
      if (event.key === "Escape")
        setEmptyContextMenu({ x: 0, y: 0, open: false });
      if (
        event.ctrlKey &&
        event.key.toLowerCase() === "x" &&
        activeFolderForMenu
      ) {
        event.preventDefault();
        cutSelectedFolder(activeFolderForMenu);
      }
      if (event.ctrlKey && event.key.toLowerCase() === "v" && cutFolder) {
        event.preventDefault();
        pasteFolder().catch((error) =>
          toast.danger(
            error instanceof Error ? error.message : "Failed to paste folder",
          ),
        );
      }
    }

    function onOpenMoveShortcut(e: Event) {
      const file = (e as CustomEvent).detail as FileItem;
      setActiveFile(file);
      setSelectedFolderId(file.folderId || "");
      setMoveOpen(true);
    }

    window.addEventListener("keydown", onKey);
    window.addEventListener("archivecloud:open-move-modal", onOpenMoveShortcut);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(
        "archivecloud:open-move-modal",
        onOpenMoveShortcut,
      );
    };
  }, [activeFolderForMenu, cutFolder, activeFolderId]);

  useEffect(() => {
    if (
      !previewOpen ||
      !activeFile?.mimeType?.startsWith("video/") ||
      !previewVideoRef.current
    )
      return undefined;
    let disposed = false;
    let player: { destroy: () => void } | null = null;

    ensurePlyr()
      .then(() => {
        if (disposed || !previewVideoRef.current) return;
        player = createPlyr(previewVideoRef.current);
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      player?.destroy();
    };
  }, [previewOpen, activeFile?.mimeType, previewUrl]);

  async function createFolder(event: FormEvent) {
    event.preventDefault();
    try {
      await apiFetch("/folders", {
        method: "POST",
        body: JSON.stringify({
          name: folderName,
          color: folderColor,
          parentId: activeFolderId ?? null,
        }),
      });
      setFolderName("New Folder");
      setFolderColor(defaultFolderColor);
      setFolderOpen(false);
      await loadFolders();
      toast.success("Folder created.");
    } catch (error) {
      toast.danger(
        error instanceof Error ? error.message : "Failed to create folder",
      );
    }
  }

  function openNewFolderModal() {
    setFolderName("New Folder");
    setFolderColor(defaultFolderColor);
    setFolderOpen(true);
  }

  function runSidebarCreateAction(action: SidebarCreateAction) {
    if (action === "upload") {
      setUploadOpen(true);
      return;
    }
    openNewFolderModal();
  }

  useEffect(() => {
    const action = sp.get("action");
    if (action === "upload" || action === "new-folder") {
      const params = new URLSearchParams(sp.toString());
      params.delete("action");
      const qs = params.toString();
      router.replace(qs ? `/home?${qs}` : "/home");
      runSidebarCreateAction(action);
    }
  }, [sp, router]);

  useEffect(() => {
    function onSidebarCreate(event: Event) {
      const action = (event as CustomEvent<{ action: SidebarCreateAction }>)
        .detail?.action;
      if (action === "upload") {
        setUploadOpen(true);
      } else if (action === "new-folder") {
        setFolderName("New Folder");
        setFolderColor(defaultFolderColor);
        setFolderOpen(true);
      }
    }
    window.addEventListener(SIDEBAR_CREATE_EVENT, onSidebarCreate);
    return () =>
      window.removeEventListener(SIDEBAR_CREATE_EVENT, onSidebarCreate);
  }, []);

  async function uploadFile(event: FormEvent) {
    event.preventDefault();
    if (selectedFiles.length === 0) return;
    setLoading(true);

    const uploadingFiles = [...selectedFiles];
    const targetFolderId = activeFolderId || selectedFolderId;
    const targetAccountId = selectedTargetAccountId || null;

    setSelectedFiles([]);
    setSelectedFolderId("");
    setSelectedTargetAccountId("");
    setUploadOpen(false);

    try {
      await uploadFiles(uploadingFiles, targetFolderId, targetAccountId);
    } catch (err) {
      console.error("Upload initiation failed:", err);
    } finally {
      setLoading(false);
    }
  }

  async function syncGoogleDrive() {
    setSyncingDrive(true);
    try {
      const response = await apiFetch<{
        results: { created: number; updated: number; deleted: number }[];
      }>("/files/sync-google", { method: "POST", body: JSON.stringify({}) });

      let created = 0,
        updated = 0,
        deleted = 0;
      for (const res of response.results) {
        created += res.created;
        updated += res.updated;
        deleted += res.deleted;
      }
      const accounts = response.results.length;

      toast.success(
        `Google Drive synced. ${created} added, ${updated} updated, ${deleted} removed across ${accounts} account${accounts === 1 ? "" : "s"}.`,
      );
      await loadAll();
      window.dispatchEvent(new Event("archivecloud:storage-changed"));
    } catch (error) {
      toast.danger(
        error instanceof Error ? error.message : "Failed to sync Google Drive",
      );
    } finally {
      setSyncingDrive(false);
    }
  }

  function selectUploadFiles(files: FileList | File[] | null | undefined) {
    if (!files) return;
    const nextFiles = Array.from(files);
    if (nextFiles.length === 0) return;
    setSelectedFiles(nextFiles);
  }

  function removeUploadFile(index: number) {
    setSelectedFiles((files) =>
      files.filter((_, fileIndex) => fileIndex !== index),
    );
  }

  function handleUploadDrag(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (event.type === "dragenter" || event.type === "dragover")
      setIsUploadDragging(true);
    if (event.type === "dragleave" || event.type === "drop")
      setIsUploadDragging(false);
    if (event.type === "drop") selectUploadFiles(event.dataTransfer.files);
  }

  function openContext(event: MouseEvent<HTMLElement>, file: FileItem) {
    event.preventDefault();
    event.stopPropagation();
    setActiveFile(file);
    setContextMenu({ x: event.clientX, y: event.clientY, file });
  }

  function toggleFileSelection(file: FileItem) {
    if (!file.id) return;
    setSelectedFileIds((current) => {
      const next = new Set(current);
      if (next.has(file.id!)) next.delete(file.id!);
      else next.add(file.id!);
      return next;
    });
  }

  function toggleAllVisibleFiles() {
    const visibleIds = files.map((file) => file.id).filter(Boolean) as string[];
    const allSelected =
      visibleIds.length > 0 &&
      visibleIds.every((id) => selectedFileIds.has(id));
    setSelectedFileIds(allSelected ? new Set() : new Set(visibleIds));
  }

  function clearSelection() {
    setSelectedFileIds(new Set());
  }

  function openFolderMenu(event: MouseEvent<HTMLElement>, folder: FolderItem) {
    event.preventDefault();
    event.stopPropagation();
    setActiveFolderForMenu(folder);
    setFolderContextMenu({ x: event.clientX, y: event.clientY, folder });
  }

  function openFolder(folder: FolderItem) {
    if (!folder.id) return;
    setFolderSearchParams(
      searchQuery
        ? { folderId: folder.id, q: searchQuery }
        : { folderId: folder.id },
    );
  }

  function openFolderById(folderId: string) {
    setFolderSearchParams(
      searchQuery ? { folderId, q: searchQuery } : { folderId },
    );
  }

  function openEmptyContextMenu(event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    setEmptyContextMenu({ x: event.clientX, y: event.clientY, open: true });
  }

  function closeFolder() {
    setFolderSearchParams(searchQuery ? { q: searchQuery } : {});
  }

  async function viewFile() {
    if (!activeFile?.id) return;
    await openFilePreview(activeFile);
  }

  async function openFilePreview(file: FileItem) {
    if (!file.id) return;
    setActiveFile(file);
    setPreviewUrl("");
    setPreviewError("");
    setPreviewLoading(true);
    setPreviewOpen(true);
    setContextMenu({ x: 0, y: 0, file: null });
    try {
      const data = await apiFetch<{ path?: string; url: string }>(
        `/files/${file.id}/preview-token`,
        { method: "POST" },
      );
      const previewPath = data.path ?? new URL(data.url).pathname;
      setPreviewUrl(`${API_URL}${previewPath}`);
    } catch (error) {
      setPreviewError(
        error instanceof Error ? error.message : "Failed to load preview",
      );
    } finally {
      setPreviewLoading(false);
    }
  }

  async function downloadFile() {
    if (!activeFile?.id) return;
    const response = await fetch(`${API_URL}/files/${activeFile.id}/download`, {
      credentials: "same-origin",
    });
    if (!response.ok) throw new Error("Download failed");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = activeFile.name;
    link.click();
    URL.revokeObjectURL(url);
    setContextMenu({ x: 0, y: 0, file: null });
  }

  async function downloadBatchAsZip() {
    const selectedIds = [...selectedFileIds];
    if (selectedIds.length === 0) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/files/batch-download`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fileIds: selectedIds }),
      });
      if (!response.ok) throw new Error("Failed to download ZIP file");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "archivecloud-download.zip";
      link.click();
      URL.revokeObjectURL(url);
      clearSelection();
      toast.success("Batch download complete.");
    } catch (error) {
      toast.danger(
        error instanceof Error ? error.message : "Batch download failed",
      );
    } finally {
      setLoading(false);
    }
  }

  async function renameFile(event: FormEvent) {
    event.preventDefault();
    if (!activeFile?.id) return;
    await apiFetch(`/files/${activeFile.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: renameValue }),
    });
    setRenameOpen(false);
    await loadFiles();
  }

  async function moveFile(event: FormEvent) {
    event.preventDefault();
    const selectedIds = [...selectedFileIds];
    if (selectedIds.length > 0)
      await apiFetch("/files/batch", {
        method: "PATCH",
        body: JSON.stringify({
          fileIds: selectedIds,
          folderId: selectedFolderId || null,
        }),
      });
    else if (activeFile?.id)
      await apiFetch(`/files/${activeFile.id}`, {
        method: "PATCH",
        body: JSON.stringify({ folderId: selectedFolderId || null }),
      });
    else return;
    setMoveOpen(false);
    setSelectedFolderId("");
    clearSelection();
    await loadFiles();
  }

  async function deleteFile() {
    const selectedIds = [...selectedFileIds];
    if (selectedIds.length > 0)
      await apiFetch("/files/batch", {
        method: "DELETE",
        body: JSON.stringify({ fileIds: selectedIds }),
      });
    else if (activeFile?.id)
      await apiFetch(`/files/${activeFile.id}`, { method: "DELETE" });
    else return;
    setDeleteOpen(false);
    clearSelection();
    await loadFiles();
    window.dispatchEvent(new Event("archivecloud:storage-changed"));
  }

  async function toggleStar() {
    if (!activeFile?.id) return;
    await updateFilesMetadata([activeFile.id], {
      isStarred: !activeFile.isStarred,
    });
    setContextMenu({ x: 0, y: 0, file: null });
    await loadFiles();
  }

  async function toggleArchive() {
    if (!activeFile?.id) return;
    await updateFilesMetadata([activeFile.id], {
      isArchived: !activeFile.isArchived,
    });
    setContextMenu({ x: 0, y: 0, file: null });
    await loadFiles();
    window.dispatchEvent(new Event("archivecloud:storage-changed"));
  }

  async function shareFile(fileOverride?: FileItem | null) {
    const target = fileOverride ?? activeFile;
    if (!target?.id) return;
    if (fileOverride) setActiveFile(fileOverride);
    const data = await apiFetch<{
      url: string | null;
      alreadyShared?: boolean;
      shareId: string;
    }>(`/files/${target.id}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    setShareUrl(data.url ?? "");
    setCopiedShareLink(false);
    setGdrivePublicUrl("");
    setMakingPublic(false);
    setShareOpen(true);
    setContextMenu({ x: 0, y: 0, file: null });
  }

  async function regenerateShareLink() {
    if (!activeFile?.id) return;
    const data = await apiFetch<{ url: string }>(
      `/files/${activeFile.id}/share`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rotate: true }),
      },
    );
    setShareUrl(data.url);
    setCopiedShareLink(false);
  }

  async function goToGoogleDrive(fileOverride?: FileItem | null) {
    const target = fileOverride ?? activeFile;
    if (!target?.id) return;
    try {
      const data = await apiFetch<{ url: string | null }>(
        `/files/${target.id}/view-url`,
      );
      if (data.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
      } else if (target.providerFileId) {
        window.open(
          `https://drive.google.com/open?id=${target.providerFileId}`,
          "_blank",
          "noopener,noreferrer",
        );
      } else {
        toast.danger("Google Drive link is not available for this file.");
      }
    } catch (error) {
      toast.danger(
        error instanceof Error ? error.message : "Failed to open Google Drive",
      );
    }
    setContextMenu({ x: 0, y: 0, file: null });
  }

  async function openAddToVirtualFolder(fileOverride?: FileItem | null) {
    const target = fileOverride ?? activeFile;
    if (!target?.id) return;
    if (fileOverride) setActiveFile(fileOverride);
    setContextMenu({ x: 0, y: 0, file: null });
    try {
      const data = await apiFetch<{
        folders: Array<{ id: string; name: string }>;
      }>("/vf");
      const foldersList = data.folders ?? [];
      setVirtualFolders(foldersList);
      setVirtualFolderId(foldersList[0]?.id ?? "");
      setVirtualFolderOpen(true);
    } catch (error) {
      toast.danger(
        error instanceof Error
          ? error.message
          : "Failed to load virtual folders",
      );
    }
  }

  async function addActiveFileToVirtualFolder() {
    if (!activeFile?.id || !virtualFolderId) return;
    if (!activeFile.connectedAccountId || !activeFile.providerFileId) {
      toast.danger("This file cannot be added to a virtual folder yet.");
      return;
    }
    setAddingToVirtual(true);
    try {
      await apiFetch(`/vf/${virtualFolderId}/items`, {
        method: "POST",
        body: JSON.stringify({
          connectedAccountId: activeFile.connectedAccountId,
          providerFileId: activeFile.providerFileId,
          name: activeFile.name,
          mimeType: activeFile.mimeType,
          sizeBytes: activeFile.sizeBytes,
          kind: "file",
        }),
      });
      toast.success("Added to virtual folder");
      setVirtualFolderOpen(false);
      setVirtualFolderId("");
    } catch (error) {
      toast.danger(
        error instanceof Error
          ? error.message
          : "Failed to add to virtual folder",
      );
    } finally {
      setAddingToVirtual(false);
    }
  }

  async function copyShareLinkDirect(fileOverride?: FileItem | null) {
    const target = fileOverride ?? activeFile;
    if (!target?.id) return;
    if (fileOverride) setActiveFile(fileOverride);
    try {
      const data = await apiFetch<{ url: string | null }>(
        `/files/${target.id}/view-url`,
      );
      if (data.url) {
        await navigator.clipboard.writeText(data.url);
        toast.success("Google Drive link copied to clipboard!");
      } else {
        const shareData = await apiFetch<{ url: string }>(
          `/files/${target.id}/share`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rotate: true }),
          },
        );
        await navigator.clipboard.writeText(shareData.url);
        toast.success("Share link copied to clipboard!");
      }
    } catch (err: any) {
      toast.danger(`Failed to copy link: ${err.message || err}`);
    }
    setContextMenu({ x: 0, y: 0, file: null });
  }

  async function inviteToFile() {
    if (!activeFile?.id) return;
    setInviteTargetType("file");
    setInviteTargetId(activeFile.id);
    setInviteOpen(true);
    setContextMenu({ x: 0, y: 0, file: null });
  }

  async function inviteToFolder() {
    if (!activeFolderForMenu?.id) return;
    setInviteTargetType("folder");
    setInviteTargetId(activeFolderForMenu.id);
    setInviteOpen(true);
    setFolderContextMenu({ x: 0, y: 0, folder: null });
  }

  async function copyFolderLink() {
    if (!activeFolderForMenu?.id) return;
    let url = `${window.location.origin}/home?folderId=${activeFolderForMenu.id}`;
    if (activeFolderForMenu.providerFolderId) {
      url = `https://drive.google.com/open?id=${activeFolderForMenu.providerFolderId}`;
    }
    await navigator.clipboard.writeText(url);
    toast.success("Folder link copied to clipboard!");
    setFolderContextMenu({ x: 0, y: 0, folder: null });
  }

  async function sendInvite(event: FormEvent) {
    event.preventDefault();
    if (!inviteTargetId) return;
    setInviting(true);
    setInviteMessage("");
    try {
      await apiFetch("/invites", {
        method: "POST",
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
          targetType: inviteTargetType,
          targetId: inviteTargetId,
        }),
      });
      setInviteEmail("");
      setInviteRole("viewer");
      setInviteMessage("Invite saved. Member will appear in Shared.");
      window.dispatchEvent(new Event("archivecloud:invites-changed"));
      if (inviteTargetType === "folder") {
        await loadAll();
      }
    } catch (error) {
      setInviteMessage(
        error instanceof Error ? error.message : "Failed to send invite",
      );
    } finally {
      setInviting(false);
    }
  }

  async function copyShareLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopiedShareLink(true);
    window.setTimeout(() => setCopiedShareLink(false), 1600);
  }

  async function renameFolder(event: FormEvent) {
    event.preventDefault();
    if (!activeFolderForMenu?.id) return;
    await apiFetch(`/folders/${activeFolderForMenu.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: folderRenameValue,
        color: folderRenameColor,
      }),
    });
    setFolderRenameOpen(false);
    await loadFolders();
  }

  async function deleteFolder() {
    if (!activeFolderForMenu?.id) return;
    await apiFetch(`/folders/${activeFolderForMenu.id}`, { method: "DELETE" });
    setFolderDeleteOpen(false);
    await loadFolders();
  }

  function cutSelectedFolder(folder: FolderItem | null) {
    if (!folder?.id) return;
    setCutFolder(folder);
    setFolderContextMenu({ x: 0, y: 0, folder: null });
    toast.info(
      `Folder "${folder.name}" ready to move. Open target folder and press Ctrl+V.`,
    );
  }

  async function pasteFolder() {
    if (!cutFolder?.id) return;
    await apiFetch(`/folders/${cutFolder.id}`, {
      method: "PATCH",
      body: JSON.stringify({ parentId: activeFolderId ?? null }),
    });
    toast.success(`Folder "${cutFolder.name}" moved.`);
    setCutFolder(null);
    await loadFolders();
  }

  function closePreview() {
    setPreviewUrl("");
    setPreviewError("");
    setPreviewLoading(false);
    setPreviewOpen(false);
  }

  useEffect(() => {
    function handleUploadCompleted() {
      loadAll().catch(() => undefined);
    }
    window.addEventListener(
      "archivecloud:upload-completed",
      handleUploadCompleted,
    );
    return () =>
      window.removeEventListener(
        "archivecloud:upload-completed",
        handleUploadCompleted,
      );
  }, [activeFolderId]);

  const activeFolder = allFolders.find(
    (folder) => folder.id === activeFolderId,
  );
  const folderBreadcrumbs = (() => {
    if (!activeFolder) return [];
    const foldersById = new Map(
      allFolders.map((folder) => [folder.id, folder]),
    );
    const path: FolderItem[] = [];
    const visited = new Set<string>();
    let current: FolderItem | undefined = activeFolder;
    while (current?.id && !visited.has(current.id)) {
      path.unshift(current);
      visited.add(current.id);
      current = current.parentId
        ? foldersById.get(current.parentId)
        : undefined;
    }
    return path;
  })();
  const allVisibleSelected =
    files.length > 0 &&
    files.every((file) => file.id && selectedFileIds.has(file.id));
  const activePreviewKind = getPreviewKind(
    activeFile?.mimeType,
    activeFile?.name,
  );
  const previewImageFiles = useMemo(
    () =>
      files.filter(
        (file) => getPreviewKind(file.mimeType, file.name) === "image",
      ),
    [files],
  );
  const previewImageIndex = activeFile?.id
    ? previewImageFiles.findIndex((file) => file.id === activeFile.id)
    : -1;
  const homeGreeting = (
    <>
      {getTimeGreeting()},{" "}
      <span className="text-primary">{getFirstName(session?.user?.name)}</span>
    </>
  );
  const showConnectOnboarding =
    accountsLoaded &&
    connectedAccounts.length === 0 &&
    !activeFolderId &&
    !searchQuery;
  const showConnectOnboardingSkeleton =
    !accountsLoaded && !activeFolderId && !searchQuery;

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: page shell exposes empty-area context menu */}
      <div
        onContextMenu={openEmptyContextMenu}
        className="min-h-[620px] w-full min-w-0"
      >
        {showConnectOnboardingSkeleton ? (
          <NoConnectedAccountsEmptyStateSkeleton />
        ) : showConnectOnboarding ? (
          <NoConnectedAccountsEmptyState
            userName={session?.user?.name}
            onConnected={() => {
              void apiFetch<{ accounts: ConnectedAccount[] }>(
                "/connected-accounts",
              )
                .then((data) => {
                  setConnectedAccounts(data.accounts || []);
                  setAccountsLoaded(true);
                })
                .catch(() => undefined);
            }}
          />
        ) : (
          <>
            <PageHeader
              title={
                activeFolder ? (
                  <span className="block min-w-0 truncate">
                    <button
                      type="button"
                      className="text-foreground hover:underline"
                      onClick={closeFolder}
                    >
                      Home
                    </button>
                    {folderBreadcrumbs.map((folder, index) => (
                      <span key={folder.id}>
                        <span className="text-muted"> / </span>
                        {index === folderBreadcrumbs.length - 1 ? (
                          <span>{folder.name}</span>
                        ) : (
                          <button
                            type="button"
                            className="text-foreground hover:underline"
                            onClick={() =>
                              folder.id && openFolderById(folder.id)
                            }
                          >
                            {folder.name}
                          </button>
                        )}
                      </span>
                    ))}
                  </span>
                ) : (
                  homeGreeting
                )
              }
              actions={
                <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
                  <Popover>
                    <Popover.Trigger className="inline-flex h-10 min-w-[9.5rem] max-w-[12rem] cursor-pointer items-center justify-between gap-2 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-foreground shadow-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        {selectedAccount ? (
                          <AccountProviderIcon
                            provider={selectedAccount.provider}
                          />
                        ) : null}
                        <span className="truncate">
                          {selectedAccount
                            ? accountTitle(selectedAccount)
                            : "All Accounts"}
                        </span>
                      </span>
                      <ChevronsExpandVertical className="h-3 w-3 shrink-0 text-muted" />
                    </Popover.Trigger>
                    <Popover.Content className="w-64 p-1.5">
                      <Popover.Dialog>
                        <button
                          type="button"
                          className={cn(
                            "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm",
                            !filterAccountId
                              ? "bg-primary/10 font-semibold text-primary"
                              : "font-medium text-foreground hover:bg-black/5",
                          )}
                          onClick={() =>
                            patchHomeParams({ accountId: null, folderId: null })
                          }
                        >
                          All Accounts
                        </button>
                        {connectedAccounts.map((account) => (
                          <button
                            key={account.id}
                            type="button"
                            className={cn(
                              "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm",
                              filterAccountId === account.id
                                ? "bg-primary/10 font-semibold text-primary"
                                : "font-medium text-foreground hover:bg-black/5",
                            )}
                            onClick={() =>
                              patchHomeParams({
                                accountId: account.id,
                                folderId: null,
                              })
                            }
                          >
                            <AccountProviderIcon provider={account.provider} />
                            <span className="min-w-0 flex-1 truncate">
                              {accountTitle(account)}
                            </span>
                          </button>
                        ))}
                      </Popover.Dialog>
                    </Popover.Content>
                  </Popover>

                  <Popover>
                    <Popover.Trigger className="inline-flex h-10 min-w-[10rem] max-w-[13rem] cursor-pointer items-center justify-between gap-2 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-foreground shadow-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <Sliders className="h-4 w-4 shrink-0 text-muted" />
                        <span className="truncate">{activeSortLabel}</span>
                      </span>
                      <ChevronsExpandVertical className="h-3 w-3 shrink-0 text-muted" />
                    </Popover.Trigger>
                    <Popover.Content className="w-56 p-1.5">
                      <Popover.Dialog>
                        {FILE_SORT_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={cn(
                              "flex w-full cursor-pointer items-center rounded-lg px-2.5 py-2 text-left text-sm",
                              activeSort === option.value
                                ? "bg-primary/10 font-semibold text-primary"
                                : "font-medium text-foreground hover:bg-black/5",
                            )}
                            onClick={() =>
                              patchHomeParams({
                                sort:
                                  option.value === "created_desc"
                                    ? null
                                    : option.value,
                              })
                            }
                          >
                            {option.label}
                          </button>
                        ))}
                      </Popover.Dialog>
                    </Popover.Content>
                  </Popover>

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-10"
                    isDisabled={syncingDrive}
                    onPress={() => syncGoogleDrive().catch(() => undefined)}
                  >
                    <ArrowRotateRight
                      className={
                        syncingDrive ? "h-4 w-4 animate-spin" : "h-4 w-4"
                      }
                    />
                    {syncingDrive ? "Syncing..." : "Sync"}
                  </Button>

                  <FileViewToggle
                    mode={fileViewMode}
                    onChange={changeFileViewMode}
                  />
                </div>
              }
            />
            {!activeFolder ? (
              <SuggestedSection
                title="Suggested folders"
                variant="plain"
                open={suggestedFoldersOpen}
                onOpenChange={setSuggestedFoldersOpen}
              >
                {folders.length > 0 ? (
                  <FolderGrid
                    items={folders}
                    mobileTwoColumns
                    sizeScale="xs"
                    onFolderMenu={openFolderMenu}
                    onFolderOpen={openFolder}
                    onDropItem={handleDropItem}
                  />
                ) : (
                  <div className="flex min-h-[160px] items-center justify-center py-6">
                    <p className="text-center text-sm text-muted">
                      No folders yet. Use Add New in the sidebar or right-click
                      to create one.
                    </p>
                  </div>
                )}
              </SuggestedSection>
            ) : folders.length > 0 ? (
              <SuggestedSection
                title="Folders"
                variant="plain"
                open={suggestedFoldersOpen}
                onOpenChange={setSuggestedFoldersOpen}
              >
                <FolderGrid
                  items={folders}
                  sizeScale="xs"
                  onFolderMenu={openFolderMenu}
                  onFolderOpen={openFolder}
                  onDropItem={handleDropItem}
                />
              </SuggestedSection>
            ) : null}
            {selectedFileIds.size > 0 ? (
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
                            const file = files.find((item) => item.id === id);
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
                            const file = files.find((item) => item.id === id);
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
                      onClick={() => setMoveOpen(true)}
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
                          const file = files.find((item) => item.id === id);
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
            ) : null}
            {cutFolder ? (
              <p className="mt-3 rounded-xl bg-surface-secondary p-3 text-sm font-semibold text-foreground">
                <CopyCheck className="mr-2 inline h-4 w-4" />
                Cut folder: {cutFolder.name}. Press Ctrl+V or right-click empty
                area to paste here.
              </p>
            ) : null}
            <SuggestedSection
              title={activeFolder ? "Files" : "Suggested files"}
              variant="plain"
              open={suggestedFilesOpen}
              onOpenChange={setSuggestedFilesOpen}
            >
              {files.length === 0 ? (
                <div className="flex min-h-[160px] items-center justify-center py-6">
                  <p className="text-center text-sm text-muted">
                    {searchQuery
                      ? `No files found for "${searchQuery}".`
                      : activeFolder
                        ? "No files in this folder yet."
                        : connectedAccounts.some(
                              (account) =>
                                account.provider === "google_drive" &&
                                account.status === "connected",
                            )
                          ? syncingDrive
                            ? "Syncing files from your connected Google Drive..."
                            : "No files in this view yet. Click Sync to refresh from connected Drive, or Upload a file."
                          : "No uploaded files yet. Connect Google Drive, then Sync or upload a file."}
                  </p>
                </div>
              ) : fileViewMode === "grid" ? (
                <FileGrid
                  files={files}
                  selectedFileIds={selectedFileIds}
                  sizeScale="xs"
                  onToggleFile={toggleFileSelection}
                  onFileContextMenu={openContext}
                  onFileOpen={(file) => {
                    void openFilePreview(file);
                  }}
                />
              ) : fileViewMode === "calendar" ? (
                <div className="grid gap-4">
                  {filesByDay.map(([day, dayFiles]) => (
                    <section key={day} className="min-w-0">
                      <h3 className="mb-2 text-sm font-bold text-foreground">
                        {day}
                      </h3>
                      <FileGrid
                        files={dayFiles}
                        selectedFileIds={selectedFileIds}
                        sizeScale="xs"
                        onToggleFile={toggleFileSelection}
                        onFileContextMenu={openContext}
                        onFileOpen={(file) => {
                          void openFilePreview(file);
                        }}
                      />
                    </section>
                  ))}
                </div>
              ) : (
                <FileTable
                  files={files}
                  selectedFileIds={selectedFileIds}
                  allSelected={allVisibleSelected}
                  onToggleFile={toggleFileSelection}
                  onToggleAll={toggleAllVisibleFiles}
                  onFileContextMenu={openContext}
                />
              )}
            </SuggestedSection>
          </>
        )}
      </div>
      <EmptyAreaContextMenu
        x={emptyContextMenu.x}
        y={emptyContextMenu.y}
        open={emptyContextMenu.open}
        canPasteFolder={Boolean(cutFolder)}
        onClose={() => setEmptyContextMenu({ x: 0, y: 0, open: false })}
        onUpload={() => {
          setUploadOpen(true);
          setEmptyContextMenu({ x: 0, y: 0, open: false });
        }}
        onCreateFolder={() => {
          openNewFolderModal();
          setEmptyContextMenu({ x: 0, y: 0, open: false });
        }}
        onPasteFolder={() => {
          pasteFolder().catch((error) =>
            toast.danger(
              error instanceof Error ? error.message : "Failed to paste folder",
            ),
          );
          setEmptyContextMenu({ x: 0, y: 0, open: false });
        }}
      />
      <FileContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        file={contextMenu.file}
        onClose={() => setContextMenu({ x: 0, y: 0, file: null })}
        onDetails={() => {
          setDetailOpen(true);
          setContextMenu({ x: 0, y: 0, file: null });
        }}
        onGoToDrive={() => {
          void goToGoogleDrive();
        }}
        onRename={() => {
          setRenameValue(activeFile?.name ?? "");
          setRenameOpen(true);
          setContextMenu({ x: 0, y: 0, file: null });
        }}
        onDownload={() => {
          void downloadFile();
        }}
        onMove={() => {
          setMoveOpen(true);
          setContextMenu({ x: 0, y: 0, file: null });
        }}
        onRemove={() => {
          setDeleteOpen(true);
          setContextMenu({ x: 0, y: 0, file: null });
        }}
        onManageTags={() => {
          setDetailOpen(true);
          setContextMenu({ x: 0, y: 0, file: null });
        }}
        onPublicLink={() => {
          void shareFile();
        }}
        onAddToVirtualFolder={() => {
          void openAddToVirtualFolder();
        }}
      />
      <FolderContextMenu
        x={folderContextMenu.x}
        y={folderContextMenu.y}
        folder={folderContextMenu.folder}
        onClose={() => setFolderContextMenu({ x: 0, y: 0, folder: null })}
        onCut={() => cutSelectedFolder(activeFolderForMenu)}
        onRename={() => {
          setFolderRenameValue(activeFolderForMenu?.name ?? "");
          setFolderRenameColor(
            normalizeFolderColor(activeFolderForMenu?.color),
          );
          setFolderRenameOpen(true);
          setFolderContextMenu({ x: 0, y: 0, folder: null });
        }}
        onInvite={inviteToFolder}
        onCopyLink={copyFolderLink}
        onDelete={() => {
          setFolderDeleteOpen(true);
          setFolderContextMenu({ x: 0, y: 0, folder: null });
        }}
      />
      <FileDetailsDrawer
        open={detailOpen}
        file={activeFile}
        onClose={() => setDetailOpen(false)}
      />

      <DummyModal
        open={uploadOpen}
        title="Upload File"
        description="Stream file directly to selected Google Drive account."
        onClose={() => setUploadOpen(false)}
      >
        <form onSubmit={uploadFile} className="grid gap-4">
          {/* biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop upload target */}
          <div
            onDragEnter={handleUploadDrag}
            onDragOver={handleUploadDrag}
            onDragLeave={handleUploadDrag}
            onDrop={handleUploadDrag}
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
              onChange={(event) => selectUploadFiles(event.target.files)}
              required={selectedFiles.length === 0}
            />
          </div>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Target Storage Account
            <select
              className="h-11 rounded-xl border border-border bg-white px-3 text-sm text-foreground"
              value={selectedTargetAccountId}
              onChange={(event) =>
                setSelectedTargetAccountId(event.target.value)
              }
            >
              <option value="">Automatic (Default)</option>
              {connectedAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.email || account.displayName || account.id} (
                  {account.provider === "s3" ? "S3" : "Google Drive"})
                </option>
              ))}
            </select>
          </label>
          {activeFolder ? (
            <p className="rounded-xl bg-background-secondary p-3 text-sm text-muted">
              Uploading to:{" "}
              <b className="text-foreground">{activeFolder.name}</b>
            </p>
          ) : (
            <label className="grid gap-2 text-sm font-semibold text-foreground">
              Virtual Folder
              <select
                className="h-11 rounded-xl border border-border bg-white px-3 text-sm text-foreground"
                value={selectedFolderId}
                onChange={(event) => setSelectedFolderId(event.target.value)}
              >
                <option value="">No folder</option>
                {allFolders.map((folder) => (
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
                    onClick={() => removeUploadFile(index)}
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
              onClick={() => setUploadOpen(false)}
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
      <DummyModal
        open={folderOpen}
        title="New Folder"
        description="Create a virtual folder for organizing files."
        onClose={() => setFolderOpen(false)}
      >
        <form onSubmit={createFolder} className="grid gap-4">
          <div className="grid gap-2 text-sm font-semibold">
            Folder Name
            <Input
              fullWidth
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
              placeholder="New Folder"
              required
            />
          </div>
          <FolderColorFields
            color={folderColor}
            onColorChange={setFolderColor}
          />
          <div className="grid gap-3 pt-2 sm:flex sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setFolderOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Create Folder</Button>
          </div>
        </form>
      </DummyModal>
      <DummyModal
        open={renameOpen}
        title="Rename File"
        description={activeFile?.name ?? ""}
        onClose={() => setRenameOpen(false)}
      >
        <form onSubmit={renameFile} className="grid gap-4">
          <Input
            fullWidth
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            required
          />
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRenameOpen(false)}
            >
              Cancel
            </Button>
            <Button>Rename</Button>
          </div>
        </form>
      </DummyModal>
      <DummyModal
        open={moveOpen}
        title="Move to Folder"
        description={
          selectedFileIds.size > 0
            ? `Move ${selectedFileIds.size} files`
            : (activeFile?.name ?? "")
        }
        onClose={() => setMoveOpen(false)}
      >
        <form onSubmit={moveFile} className="grid gap-4">
          <select
            className="h-11 rounded-xl border border-border px-3 text-sm"
            value={selectedFolderId}
            onChange={(event) => setSelectedFolderId(event.target.value)}
          >
            <option value="">No folder</option>
            {allFolders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setMoveOpen(false)}
            >
              Cancel
            </Button>
            <Button>Move</Button>
          </div>
        </form>
      </DummyModal>
      <DummyModal
        open={deleteOpen}
        title={selectedFileIds.size > 0 ? "Delete Files" : "Delete File"}
        description={
          selectedFileIds.size > 0
            ? `Delete ${selectedFileIds.size} files from Google Drive?`
            : `Delete ${activeFile?.name ?? "file"} from Google Drive?`
        }
        onClose={() => setDeleteOpen(false)}
      >
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setDeleteOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={deleteFile}>
            Delete
          </Button>
        </div>
      </DummyModal>
      <DummyModal
        open={shareOpen}
        title="Share Link"
        description={activeFile?.name ?? ""}
        onClose={() => setShareOpen(false)}
      >
        <div className="grid gap-4">
          <div>
            <p className="text-xs font-bold text-muted block mb-1">
              Archive Cloud Public Share Link (No GDrive login required)
            </p>
            {shareUrl ? (
              <Input fullWidth value={shareUrl} readOnly />
            ) : (
              <div className="grid gap-2">
                <p className="rounded-xl bg-surface-secondary p-3 text-sm text-muted">
                  A public link is already active. The raw token is not stored,
                  so regenerate to copy a new link (this invalidates the old
                  one).
                </p>
                <Button variant="outline" onClick={regenerateShareLink}>
                  Regenerate link
                </Button>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShareOpen(false)}>
              Close
            </Button>
            <Button onClick={copyShareLink} isDisabled={!shareUrl}>
              {copiedShareLink ? <CircleCheck className="h-4 w-4" /> : null}
              {copiedShareLink ? "Copied!" : "Copy Link"}
            </Button>
          </div>
          {copiedShareLink ? (
            <p className="rounded-xl bg-surface-secondary p-3 text-sm font-semibold text-foreground">
              Share link copied to clipboard.
            </p>
          ) : null}

          {activeFile?.accountProvider === "google_drive" && (
            <div className="mt-4 pt-4 border-t border-separator dark:border-border grid gap-3">
              <div>
                <p className="text-xs font-bold text-muted block mb-1">
                  Google Drive Direct Link (Public Access)
                </p>
                <p className="text-xs text-muted mb-2">
                  Make this file publicly viewable on Google Drive so external
                  tools can open or download it (read-only, not editable).
                </p>
              </div>
              {gdrivePublicUrl ? (
                <div className="grid gap-2">
                  <Input fullWidth value={gdrivePublicUrl} readOnly />
                  <p className="rounded-xl bg-surface-secondary p-3 text-sm font-semibold text-foreground">
                    Google Drive public link generated and copied to clipboard!
                  </p>
                </div>
              ) : (
                <Button
                  variant="outline"
                  isDisabled={makingPublic}
                  onClick={async () => {
                    if (!activeFile?.id) return;
                    setMakingPublic(true);
                    try {
                      const res = await apiFetch<{ url: string }>(
                        `/files/${activeFile.id}/public-permission`,
                        { method: "POST" },
                      );
                      setGdrivePublicUrl(res.url);
                      await navigator.clipboard.writeText(res.url);
                    } catch (err: any) {
                      alert(
                        `Failed to update Google Drive permission: ${err.message || err}`,
                      );
                    } finally {
                      setMakingPublic(false);
                    }
                  }}
                  className="w-full text-foreground bg-surface-secondary border-border hover:bg-surface-secondary dark:text-muted dark:bg-accent/40 dark:border-border"
                >
                  {makingPublic
                    ? "Making Public..."
                    : "Make Public & Copy GDrive Link"}
                </Button>
              )}
            </div>
          )}
        </div>
      </DummyModal>
      <DummyModal
        open={folderRenameOpen}
        title="Rename Folder"
        description={activeFolderForMenu?.name ?? ""}
        onClose={() => setFolderRenameOpen(false)}
      >
        <form onSubmit={renameFolder} className="grid gap-4">
          <Input
            fullWidth
            value={folderRenameValue}
            onChange={(event) => setFolderRenameValue(event.target.value)}
            required
          />
          <FolderColorFields
            color={folderRenameColor}
            onColorChange={setFolderRenameColor}
          />
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setFolderRenameOpen(false)}
            >
              Cancel
            </Button>
            <Button>Rename</Button>
          </div>
        </form>
      </DummyModal>
      <DummyModal
        open={folderDeleteOpen}
        title="Delete Folder"
        description={`Delete virtual folder ${activeFolderForMenu?.name ?? ""}? Files inside will remain uploaded.`}
        onClose={() => setFolderDeleteOpen(false)}
      >
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setFolderDeleteOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={deleteFolder}>
            Delete
          </Button>
        </div>
      </DummyModal>
      <DummyModal
        open={virtualFolderOpen}
        title="Add to Virtual Folder"
        description={activeFile?.name ?? ""}
        onClose={() => {
          setVirtualFolderOpen(false);
          setVirtualFolderId("");
        }}
      >
        <div className="grid gap-4">
          {virtualFolders.length === 0 ? (
            <p className="rounded-xl bg-surface-secondary p-3 text-sm text-muted">
              No virtual folders yet. Create one from the Virtual Folders page.
            </p>
          ) : (
            <div className="grid gap-2 text-sm font-semibold">
              Virtual folder
              <select
                className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm"
                value={virtualFolderId}
                onChange={(event) => setVirtualFolderId(event.target.value)}
              >
                {virtualFolders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setVirtualFolderOpen(false);
                setVirtualFolderId("");
              }}
            >
              Cancel
            </Button>
            <Button
              isDisabled={
                !virtualFolderId ||
                addingToVirtual ||
                virtualFolders.length === 0
              }
              onPress={() => void addActiveFileToVirtualFolder()}
            >
              {addingToVirtual ? "Adding…" : "Add"}
            </Button>
          </div>
        </div>
      </DummyModal>
      <DummyModal
        open={inviteOpen}
        title="Invite Member"
        description={`Share ${inviteTargetType === "file" ? (activeFile?.name ?? "file") : (activeFolderForMenu?.name ?? "folder")} with a team member.`}
        onClose={() => setInviteOpen(false)}
      >
        <form onSubmit={sendInvite} className="grid gap-4">
          <div className="grid gap-2 text-sm font-semibold">
            Email Address
            <Input
              fullWidth
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="member@example.com"
              required
            />
          </div>
          <label className="grid gap-2 text-sm font-semibold">
            Role
            <select
              className="h-11 rounded-xl border border-border px-3 text-sm"
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value)}
            >
              <option value="viewer">Can view</option>
              <option value="editor">Can edit</option>
            </select>
          </label>
          {inviteMessage ? (
            <p className="rounded-xl bg-surface-secondary p-3 text-sm font-semibold text-foreground">
              {inviteMessage}
            </p>
          ) : null}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setInviteOpen(false)}
              isDisabled={inviting}
              className={inviting ? "opacity-50" : undefined}
            >
              Cancel
            </Button>
            <Button isDisabled={inviting}>
              {inviting ? "Sending..." : "Send Invite"}
            </Button>
          </div>
        </form>
      </DummyModal>
      {previewOpen && activePreviewKind === "image" ? (
        <ImageLightbox
          open={previewOpen}
          src={previewUrl}
          fileName={activeFile?.name ?? ""}
          loading={previewLoading}
          error={previewError}
          hasPrev={previewImageIndex > 0}
          hasNext={
            previewImageIndex >= 0 &&
            previewImageIndex < previewImageFiles.length - 1
          }
          onClose={closePreview}
          onInfo={() => setDetailOpen(true)}
          onOpenExternal={() => {
            if (previewUrl) window.open(previewUrl, "_blank", "noopener");
          }}
          onDownload={() => {
            downloadFile().catch((error) =>
              toast.danger(
                error instanceof Error ? error.message : "Download failed",
              ),
            );
          }}
          onPrev={() => {
            const prev = previewImageFiles[previewImageIndex - 1];
            if (prev) void openFilePreview(prev);
          }}
          onNext={() => {
            const next = previewImageFiles[previewImageIndex + 1];
            if (next) void openFilePreview(next);
          }}
        />
      ) : (
        <DummyModal
          open={previewOpen}
          title="File Preview"
          description={activeFile?.name ?? ""}
          onClose={closePreview}
          className="overflow-hidden sm:max-w-[95vw] xl:max-w-[1400px]"
        >
          <div className="flex h-[72dvh] w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-background-secondary sm:h-[80vh]">
            {previewLoading ? (
              <div
                className="skeleton--shimmer relative overflow-hidden p-6"
                role="status"
                aria-busy="true"
                aria-label="Loading preview"
              >
                <Skeleton
                  animationType="none"
                  className="h-[50vh] w-[min(80vw,720px)] rounded-xl"
                />
              </div>
            ) : null}
            {previewError ? (
              <div className="p-6 text-center text-sm text-danger">
                {previewError}
              </div>
            ) : null}
            {!previewLoading &&
            !previewError &&
            activePreviewKind === "video" &&
            previewUrl ? (
              <div className="shared-video-shell">
                <video
                  ref={previewVideoRef}
                  controls
                  playsInline
                  preload="metadata"
                  onError={() => setPreviewError("Failed to load preview.")}
                >
                  <track kind="captions" />
                  <source src={previewUrl} type={activeFile?.mimeType} />
                </video>
              </div>
            ) : null}
            {!previewLoading &&
            !previewError &&
            activePreviewKind === "document" &&
            previewUrl ? (
              <iframe
                src={previewUrl}
                title={activeFile?.name ?? "File preview"}
                className="h-full w-full border-0 bg-white"
              />
            ) : null}
            {!previewLoading &&
            !previewError &&
            activePreviewKind === "office" &&
            previewUrl ? (
              <iframe
                src={officeViewerUrl(previewUrl)}
                title={activeFile?.name ?? "File preview"}
                className="h-full w-full border-0 bg-white"
              />
            ) : null}
            {!previewLoading && !previewError && !activePreviewKind ? (
              <div className="p-6 text-center text-sm text-muted">
                Preview not available for this file type. Use Download instead.
              </div>
            ) : null}
          </div>
        </DummyModal>
      )}
    </>
  );
}
