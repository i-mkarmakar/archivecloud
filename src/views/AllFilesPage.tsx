"use client";
import { Button, Input, toast } from "@heroui/react";
import {
  Archive,
  ArrowDownToLine,
  ArrowRotateRight,
  ArrowUpFromLine,
  CircleCheck,
  CopyCheck,
  FolderArrowRight,
  FolderPlus,
  LayoutCells,
  ListUl,
  Star,
  TrashBin,
  Xmark,
} from "@gravity-ui/icons";
import { useRouter, useSearchParams } from "next/navigation";
import {
  type DragEvent,
  type FormEvent,
  type MouseEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { DummyModal } from "@/components/drive/DummyModal";
import {
  SIDEBAR_CREATE_EVENT,
  type SidebarCreateAction,
} from "@/components/dashboard/SidebarNewButton";
import { EmptyAreaContextMenu } from "@/components/drive/EmptyAreaContextMenu";
import { FileContextMenu } from "@/components/drive/FileContextMenu";
import { FileDetailsDrawer } from "@/components/drive/FileDetailsDrawer";
import { FileGrid } from "@/components/drive/FileGrid";
import { FileTable } from "@/components/drive/FileTable";
import { FolderContextMenu } from "@/components/drive/FolderContextMenu";
import { FolderGrid } from "@/components/drive/FolderGrid";
import {
  defaultFolderColor,
  folderColorOptions,
  normalizeFolderColor,
} from "@/components/drive/folder-colors";
import { PageHeader } from "@/components/drive/PageHeader";
import { useUpload } from "@/context/UploadContext";
import { updateFilesMetadata } from "@/hooks/useWorkspaceFiles";
import type { FileItem, FolderItem } from "@/data/drive-data";
import { mapApiFileToItem, type ApiFile } from "@/lib/files";
import { API_URL, apiFetch, formatBytes, formatDate } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { formatPersonalGreeting } from "@/lib/greeting";
import { createPlyr, ensurePlyr } from "@/lib/plyr";
import { getPreviewKind, officeViewerUrl } from "@/lib/preview";

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

type FileViewMode = "list" | "grid";

const fileViewStorageKey = "archivecloud:all-files-view-mode";

function getStoredFileViewMode(): FileViewMode {
  const stored = localStorage.getItem(fileViewStorageKey);
  return stored === "grid" || stored === "list" ? stored : "list";
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

  function setFolderSearchParams(params: Record<string, string>) {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) next.set(key, value);
    }
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
  const [fileViewMode, setFileViewMode] = useState<FileViewMode>(
    getStoredFileViewMode,
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
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const [connectedAccounts, setConnectedAccounts] = useState<
    ConnectedAccount[]
  >([]);
  const [selectedTargetAccountId, setSelectedTargetAccountId] = useState("");

  async function loadFiles() {
    const params = new URLSearchParams();
    if (activeFolderId) params.set("folderId", activeFolderId);
    if (searchQuery) params.set("q", searchQuery);

    // Add advanced search filters
    const kind = sp.get("kind");
    const accountId = sp.get("accountId");
    const minSize = sp.get("minSize");
    const maxSize = sp.get("maxSize");
    const startDate = sp.get("startDate");
    const endDate = sp.get("endDate");

    if (kind) params.set("kind", kind);
    if (accountId) params.set("accountId", accountId);
    if (minSize) params.set("minSize", minSize);
    if (maxSize) params.set("maxSize", maxSize);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);

    const query = params.toString();
    const path = query ? `/files?${query}` : "/files";
    const data = await apiFetch<{ files: BackendFile[] }>(path);
    setFiles(data.files.map(mapFile));
  }

  async function loadFolders() {
    const visiblePath = activeFolderId
      ? `/folders?parentId=${activeFolderId}`
      : "/folders";
    const [visibleData, allData] = await Promise.all([
      apiFetch<{ folders: BackendFolder[] }>(visiblePath),
      apiFetch<{ folders: BackendFolder[] }>("/folders?all=1"),
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
    loadAll().catch((error) =>
      toast.danger(
        error instanceof Error ? error.message : "Failed to load files",
      ),
    );
    setSelectedFileIds(new Set());
  }, [activeFolderId, searchQuery]);

  useEffect(() => {
    async function loadConnectedAccounts() {
      try {
        const data = await apiFetch<{ accounts: ConnectedAccount[] }>(
          "/connected-accounts",
        );
        setConnectedAccounts(data.accounts || []);
      } catch (error) {
        console.error("Failed to load connected accounts:", error);
      }
    }
    loadConnectedAccounts();
  }, []);

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

  function changeFileViewMode(mode: FileViewMode) {
    setFileViewMode(mode);
    localStorage.setItem(fileViewStorageKey, mode);
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
    setPreviewUrl("");
    setPreviewError("");
    setPreviewLoading(true);
    setPreviewOpen(true);
    setContextMenu({ x: 0, y: 0, file: null });
    try {
      const data = await apiFetch<{ path?: string; url: string }>(
        `/files/${activeFile.id}/preview-token`,
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

  async function shareFile() {
    if (!activeFile?.id) return;
    const data = await apiFetch<{ url: string }>(
      `/files/${activeFile.id}/share`,
      { method: "POST" },
    );
    setShareUrl(data.url);
    setCopiedShareLink(false);
    setGdrivePublicUrl("");
    setMakingPublic(false);
    setShareOpen(true);
    setContextMenu({ x: 0, y: 0, file: null });
  }

  async function copyShareLinkDirect() {
    if (!activeFile?.id) return;
    try {
      const data = await apiFetch<{ url: string | null }>(
        `/files/${activeFile.id}/view-url`,
      );
      if (data.url) {
        await navigator.clipboard.writeText(data.url);
        toast.success("Google Drive link copied to clipboard!");
      } else {
        const shareData = await apiFetch<{ url: string }>(
          `/files/${activeFile.id}/share`,
          { method: "POST" },
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

  const recentFolders = folders.slice(0, 4);
  const moreFolders = folders.slice(4);
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
  const activePreviewKind = getPreviewKind(activeFile?.mimeType);
  const homeGreeting = formatPersonalGreeting(session?.user?.name);

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: page shell exposes empty-area context menu */}
      <div
        onContextMenu={openEmptyContextMenu}
        className="min-h-[620px] w-full min-w-0"
      >
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
                        onClick={() => folder.id && openFolderById(folder.id)}
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
            <>
              <Button size="sm" onClick={() => setUploadOpen(true)}>
                <ArrowUpFromLine className="h-3.5 w-3.5" />
                Upload
              </Button>
              <Button size="sm" variant="outline" onClick={openNewFolderModal}>
                <FolderPlus className="h-3.5 w-3.5" />
                New Folder
              </Button>
              <Button
                size="sm"
                variant="outline"
                isDisabled={syncingDrive}
                onClick={syncGoogleDrive}
              >
                <ArrowRotateRight
                  className={
                    syncingDrive ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"
                  }
                />
                {syncingDrive ? "Syncing..." : "Sync"}
              </Button>
            </>
          }
        />
        {!activeFolder &&
          (recentFolders.length > 0 ? (
            <FolderGrid
              items={recentFolders}
              mobileTwoColumns
              sizeScale="sm"
              onFolderMenu={openFolderMenu}
              onFolderOpen={openFolder}
              onDropItem={handleDropItem}
            />
          ) : (
            <div className="flex min-h-[240px] items-center justify-center py-8">
              <p className="text-center text-sm text-muted">
                No folders yet. Click New Folder to organize uploads.
              </p>
            </div>
          ))}
        {!activeFolder && moreFolders.length > 0 ? (
          <>
            <h2 className="mt-4 font-extrabold text-foreground">
              More Folders
            </h2>
            <FolderGrid
              items={moreFolders}
              sizeScale="sm"
              onFolderMenu={openFolderMenu}
              onFolderOpen={openFolder}
              onDropItem={handleDropItem}
            />
          </>
        ) : null}
        {activeFolder && folders.length > 0 ? (
          <>
            <h2 className="mt-4 font-extrabold text-foreground">Folders</h2>
            <FolderGrid
              items={folders}
              sizeScale="sm"
              onFolderMenu={openFolderMenu}
              onFolderOpen={openFolder}
              onDropItem={handleDropItem}
            />
          </>
        ) : null}
        <div className="mt-4 flex flex-col gap-2 sm:mt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" className="hidden sm:inline-flex">
              <Archive className="h-4 w-4" />
              Recents
            </Button>
            <Button variant="secondary" className="hidden sm:inline-flex">
              <Star className="h-4 w-4" />
              Starred
            </Button>
            {selectedFileIds.size > 0 ? (
              <div className="flex w-full flex-col gap-3 rounded-2xl border border-border bg-surface-secondary p-3 sm:w-auto sm:flex-row sm:items-center sm:border-0 sm:bg-transparent sm:p-0">
                <span className="text-sm font-extrabold text-foreground">
                  {selectedFileIds.size} selected
                </span>
                <div className="grid grid-cols-4 gap-2 sm:flex sm:gap-3">
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={downloadBatchAsZip}
                  >
                    <ArrowDownToLine className="h-4 w-4" />
                    ZIP
                  </Button>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => setMoveOpen(true)}
                  >
                    <FolderArrowRight className="h-4 w-4" />
                    Move
                  </Button>
                  <Button
                    className="w-full"
                    variant="danger"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <TrashBin className="h-4 w-4" />
                    Delete
                  </Button>
                  <Button
                    className="w-full"
                    variant="ghost"
                    onClick={clearSelection}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
          <div className="flex gap-3">
            <Button
              variant={fileViewMode === "grid" ? "secondary" : "outline"}
              isIconOnly
              size="sm"
              aria-label="Show files as grid"
              aria-pressed={fileViewMode === "grid"}
              onClick={() => changeFileViewMode("grid")}
            >
              <LayoutCells className="h-5 w-5" />
            </Button>
            <Button
              variant={fileViewMode === "list" ? "secondary" : "outline"}
              isIconOnly
              size="sm"
              aria-label="Show files as list"
              aria-pressed={fileViewMode === "list"}
              onClick={() => changeFileViewMode("list")}
            >
              <ListUl className="h-5 w-5" />
            </Button>
          </div>
        </div>
        {cutFolder ? (
          <p className="mt-3 rounded-xl bg-surface-secondary p-3 text-sm font-semibold text-foreground">
            <CopyCheck className="mr-2 inline h-4 w-4" />
            Cut folder: {cutFolder.name}. Press Ctrl+V or right-click empty area
            to paste here.
          </p>
        ) : null}
        {files.length === 0 ? (
          <div className="mt-3 flex min-h-[200px] items-center justify-center py-8">
            <p className="text-center text-sm text-muted">
              {searchQuery
                ? `No files found for "${searchQuery}".`
                : activeFolder
                  ? "No files in this folder yet."
                  : "No uploaded files yet. Connect Google Drive in Settings, then upload a file."}
            </p>
          </div>
        ) : (
          <div className="mt-3">
            {fileViewMode === "grid" ? (
              <FileGrid
                files={files}
                selectedFileIds={selectedFileIds}
                sizeScale="sm"
                onToggleFile={toggleFileSelection}
                onFileContextMenu={openContext}
              />
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
          </div>
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
        onView={viewFile}
        onDownload={downloadFile}
        onRename={() => {
          setRenameValue(activeFile?.name ?? "");
          setRenameOpen(true);
          setContextMenu({ x: 0, y: 0, file: null });
        }}
        onMove={() => {
          setMoveOpen(true);
          setContextMenu({ x: 0, y: 0, file: null });
        }}
        onDetails={() => {
          setDetailOpen(true);
          setContextMenu({ x: 0, y: 0, file: null });
        }}
        onShare={shareFile}
        onCopyLink={copyShareLinkDirect}
        onInvite={inviteToFile}
        onToggleStar={() => {
          toggleStar().catch((error) =>
            toast.danger(
              error instanceof Error ? error.message : "Failed to update star",
            ),
          );
        }}
        onArchive={() => {
          toggleArchive().catch((error) =>
            toast.danger(
              error instanceof Error
                ? error.message
                : "Failed to update archive",
            ),
          );
        }}
        onDelete={() => {
          setDeleteOpen(true);
          setContextMenu({ x: 0, y: 0, file: null });
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
          <label className="grid gap-2 text-sm font-semibold">
            Target Storage Account
            <select
              className="h-11 rounded-xl border border-border px-3 text-sm bg-white"
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
              Uploading to: <b>{activeFolder.name}</b>
            </p>
          ) : (
            <label className="grid gap-2 text-sm font-semibold">
              Virtual Folder
              <select
                className="h-11 rounded-xl border border-border px-3 text-sm bg-white"
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
              className={loading ? "opacity-50" : undefined}
            >
              Cancel
            </Button>
            <Button isDisabled={loading || selectedFiles.length === 0}>
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
              ArchiveCloud Public Share Link (No GDrive login required)
            </p>
            <Input fullWidth value={shareUrl} readOnly />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShareOpen(false)}>
              Close
            </Button>
            <Button onClick={copyShareLink}>
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
                  Configure this file to be publicly accessible on Google Drive
                  so external tools can edit/download it.
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
      <DummyModal
        open={previewOpen}
        title="File Preview"
        description={activeFile?.name ?? ""}
        onClose={closePreview}
        className="overflow-hidden sm:max-w-[95vw] xl:max-w-[1400px]"
      >
        <div className="flex h-[72dvh] w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-background-secondary sm:h-[80vh]">
          {previewLoading ? (
            <div className="p-6 text-center text-sm font-semibold text-muted">
              Loading preview...
            </div>
          ) : null}
          {previewError ? (
            <div className="p-6 text-center text-sm text-danger">
              {previewError}
            </div>
          ) : null}
          {!previewLoading &&
          !previewError &&
          activePreviewKind === "image" &&
          previewUrl ? (
            <img
              src={previewUrl}
              alt={activeFile?.name ?? "File preview"}
              className="max-h-full max-w-full object-contain"
              onError={() => setPreviewError("Failed to load preview.")}
            />
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
    </>
  );
}
