"use client";
import {
  ArrowDownToLine,
  ArrowRotateRight,
  ArrowUpFromLine,
  ChevronsExpandVertical,
  CopyCheck,
  EllipsisVertical,
  FolderArrowRight,
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
  CONNECT_ONBOARDING_DESCRIPTION,
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
import {
  MoveDestinationModal,
  type MoveSource,
} from "@/components/drive/MoveDestinationModal";
import { ManageTagsModal } from "@/components/drive/ManageTagsModal";
import type { ManageTagsTarget } from "@/components/drive/ManageTagsModal";
import {
  AddToVirtualFolderModal,
  type AddToVirtualFolderTarget,
} from "@/components/drive/AddToVirtualFolderModal";
import { PublicLinkModal } from "@/components/drive/PublicLinkModal";
import { FolderDetailsDrawer } from "@/components/drive/FolderDetailsDrawer";
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
  avatarUrl?: string | null;
  status: string;
};

type ProviderBrowseFolder = {
  id: string;
  name: string;
  modifiedTime: string;
};

type ProviderBrowseFile = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: string;
  modifiedTime: string;
  dbFileId?: string | null;
};

type ProviderBrowseResult = {
  folders: ProviderBrowseFolder[];
  files: ProviderBrowseFile[];
  breadcrumbs?: Array<{ id: string; name: string }>;
};

const ACCOUNT_FOLDER_PREFIX = "account:";
const LINKED_FOLDER_PREFIX = "linked:";
const LINKED_FILE_PREFIX = "linked:";
const MAX_RENAME_LENGTH = 100;
const FILES_PAGE_SIZE = 40;
const LINKED_BROWSE_LIMIT = 40;

function isAccountFolderId(id: string | undefined | null) {
  return Boolean(id?.startsWith(ACCOUNT_FOLDER_PREFIX));
}

function isLinkedFolderId(id: string | undefined | null) {
  return Boolean(id?.startsWith(LINKED_FOLDER_PREFIX));
}

function isLinkedFileId(id: string | undefined | null) {
  return Boolean(id?.startsWith(LINKED_FILE_PREFIX));
}

function parseLinkedRef(id: string) {
  const rest = id.slice(LINKED_FOLDER_PREFIX.length);
  const splitAt = rest.indexOf(":");
  if (splitAt <= 0) return null;
  return {
    accountId: rest.slice(0, splitAt),
    providerId: rest.slice(splitAt + 1),
  };
}

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
  const cloudFolderId = sp.get("cloudFolder")?.trim() ?? "";
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
  const [manageTagsOpen, setManageTagsOpen] = useState(false);
  const [manageTagsTarget, setManageTagsTarget] =
    useState<ManageTagsTarget | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveSource, setMoveSource] = useState<MoveSource | null>(null);
  const [moveItemName, setMoveItemName] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [folderDetailOpen, setFolderDetailOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [filesNextCursor, setFilesNextCursor] = useState<string | null>(null);
  const [filesLoadingMore, setFilesLoadingMore] = useState(false);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [allFolders, setAllFolders] = useState<FolderItem[]>([]);
  const allFoldersLoadedRef = useRef(false);
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
  const [virtualFolderOpen, setVirtualFolderOpen] = useState(false);
  const [virtualFolderTarget, setVirtualFolderTarget] =
    useState<AddToVirtualFolderTarget | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const [connectedAccounts, setConnectedAccounts] = useState<
    ConnectedAccount[]
  >([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [selectedTargetAccountId, setSelectedTargetAccountId] = useState("");
  const [linkedFolders, setLinkedFolders] = useState<FolderItem[]>([]);
  const [linkedFiles, setLinkedFiles] = useState<FileItem[]>([]);
  const [linkedBreadcrumbs, setLinkedBreadcrumbs] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [linkedLoading, setLinkedLoading] = useState(false);
  const [accountFilterOpen, setAccountFilterOpen] = useState(false);
  const [sortFilterOpen, setSortFilterOpen] = useState(false);

  async function loadFiles(cursor?: string | null) {
    const isMore = Boolean(cursor);
    if (isMore) setFilesLoadingMore(true);

    const params = new URLSearchParams();
    params.set("limit", String(FILES_PAGE_SIZE));
    if (cursor) params.set("cursor", cursor);
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

    try {
      const data = await apiFetch<{
        files: BackendFile[];
        nextCursor: string | null;
      }>(`/files?${params.toString()}`);
      const mapped = data.files.map(mapFile);
      setFiles((prev) => (isMore ? [...prev, ...mapped] : mapped));
      setFilesNextCursor(data.nextCursor);
    } finally {
      if (isMore) setFilesLoadingMore(false);
    }
  }

  async function loadAllFoldersCatalog() {
    const allParams = new URLSearchParams({ all: "1" });
    if (filterAccountId) allParams.set("accountId", filterAccountId);
    const allData = await apiFetch<{ folders: BackendFolder[] }>(
      `/folders?${allParams.toString()}`,
    );
    setAllFolders(allData.folders.map(mapFolder));
    allFoldersLoadedRef.current = true;
  }

  async function loadFolders() {
    const folderParams = new URLSearchParams();
    if (activeFolderId) folderParams.set("parentId", activeFolderId);
    if (filterAccountId) folderParams.set("accountId", filterAccountId);
    const visibleQuery = folderParams.toString();
    const visiblePath = visibleQuery ? `/folders?${visibleQuery}` : "/folders";

    const visibleData = await apiFetch<{ folders: BackendFolder[] }>(
      visiblePath,
    );
    setFolders(visibleData.folders.map(mapFolder));

    // Full folder tree is only needed for breadcrumbs / move / create-parent.
    if (activeFolderId || moveOpen || folderOpen) {
      await loadAllFoldersCatalog();
    } else {
      setAllFolders(visibleData.folders.map(mapFolder));
      allFoldersLoadedRef.current = false;
    }
  }

  async function loadAll() {
    // Inside a linked cloud folder: only provider browse is needed.
    if (cloudFolderId) {
      setFiles([]);
      setFolders([]);
      setFilesNextCursor(null);
      return;
    }
    await Promise.all([loadFiles(), loadFolders()]);
  }

  function mapLinkedFolder(
    account: ConnectedAccount,
    folder: ProviderBrowseFolder,
  ): FolderItem {
    return {
      id: `${LINKED_FOLDER_PREFIX}${account.id}:${folder.id}`,
      name: folder.name,
      color: defaultFolderColor,
      updated: `${providerLabel(account.provider)} · ${formatDate(folder.modifiedTime)}`,
      providerFolderId: folder.id,
      connectedAccountId: account.id,
    };
  }

  function mapLinkedFile(
    account: ConnectedAccount,
    file: ProviderBrowseFile,
  ): FileItem {
    const mapped = mapApiFileToItem({
      id: file.dbFileId || `${LINKED_FILE_PREFIX}${account.id}:${file.id}`,
      name: file.name,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes || "0",
      createdAt: file.modifiedTime,
      updatedAt: file.modifiedTime,
      providerFileId: file.id,
      connectedAccountId: account.id,
      connectedAccount: {
        id: account.id,
        email: account.email,
        provider: account.provider,
        displayName: account.displayName,
        avatarUrl: account.avatarUrl ?? null,
      },
    });
    return {
      ...mapped,
      accountAvatarUrl: account.avatarUrl ?? mapped.accountAvatarUrl ?? null,
      thumbnailUrl: file.dbFileId
        ? `/files/${file.dbFileId}/thumbnail`
        : `/connected-accounts/${account.id}/files/${encodeURIComponent(file.id)}/preview`,
    };
  }

  function mapAccountAsFolder(account: ConnectedAccount): FolderItem {
    return {
      id: `${ACCOUNT_FOLDER_PREFIX}${account.id}`,
      name: accountTitle(account),
      color: defaultFolderColor,
      updated: providerLabel(account.provider),
      connectedAccountId: account.id,
    };
  }

  async function loadLinkedStorage(accounts: ConnectedAccount[]) {
    if (searchQuery || activeFolderId) {
      setLinkedFolders([]);
      setLinkedFiles([]);
      setLinkedBreadcrumbs([]);
      return;
    }

    const connected = accounts.filter(
      (account) => account.status === "connected",
    );
    if (connected.length === 0) {
      setLinkedFolders([]);
      setLinkedFiles([]);
      setLinkedBreadcrumbs([]);
      return;
    }

    setLinkedLoading(true);
    try {
      // Browse one account (optionally nested under cloudFolder).
      if (filterAccountId) {
        const account = connected.find((item) => item.id === filterAccountId);
        if (!account) {
          setLinkedFolders([]);
          setLinkedFiles([]);
          setLinkedBreadcrumbs([]);
          return;
        }

        const parentId = cloudFolderId || "root";
        const browse = await apiFetch<ProviderBrowseResult>(
          `/connected-accounts/${account.id}/browse?parentId=${encodeURIComponent(parentId)}&limit=${LINKED_BROWSE_LIMIT}`,
        );
        setLinkedFolders(
          (browse.folders ?? []).map((folder) =>
            mapLinkedFolder(account, folder),
          ),
        );
        setLinkedFiles(
          (browse.files ?? []).map((file) => mapLinkedFile(account, file)),
        );
        setLinkedBreadcrumbs(browse.breadcrumbs ?? []);
        return;
      }

      // Home: sample root folders/files across all connected accounts.
      const results = await Promise.all(
        connected.map(async (account) => {
          try {
            const browse = await apiFetch<ProviderBrowseResult>(
              `/connected-accounts/${account.id}/browse?parentId=root&limit=${LINKED_BROWSE_LIMIT}`,
            );
            return { account, browse };
          } catch (error) {
            console.warn(
              `Failed to browse ${account.provider} (${account.id}):`,
              error instanceof Error ? error.message : error,
            );
            return {
              account,
              browse: { folders: [], files: [] } as ProviderBrowseResult,
            };
          }
        }),
      );

      const nextFolders: FolderItem[] = [];
      const nextFiles: FileItem[] = [];

      for (const { account, browse } of results) {
        for (const folder of browse.folders ?? []) {
          const mapped = mapLinkedFolder(account, folder);
          mapped.updated = `${providerLabel(account.provider)} · ${accountTitle(account)}`;
          nextFolders.push(mapped);
        }
        for (const file of browse.files ?? []) {
          nextFiles.push(mapLinkedFile(account, file));
        }
      }

      if (nextFolders.length === 0 && nextFiles.length === 0) {
        setLinkedFolders(connected.map(mapAccountAsFolder));
        setLinkedFiles([]);
        setLinkedBreadcrumbs([]);
        return;
      }

      setLinkedFolders(nextFolders);
      setLinkedFiles(nextFiles);
      setLinkedBreadcrumbs([]);
    } catch (error) {
      console.warn("Failed to load linked storage browse:", error);
      if (!filterAccountId) {
        setLinkedFolders(connected.map(mapAccountAsFolder));
        setLinkedFiles([]);
      } else {
        setLinkedFolders([]);
        setLinkedFiles([]);
      }
      setLinkedBreadcrumbs([]);
    } finally {
      setLinkedLoading(false);
    }
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
  }, [activeFolderId, searchQuery, filterAccountId, activeSort, cloudFolderId]);

  useEffect(() => {
    if (!(moveOpen || folderOpen) || allFoldersLoadedRef.current) return;
    void loadAllFoldersCatalog().catch(() => undefined);
  }, [moveOpen, folderOpen]);

  const connectedAccountKey = useMemo(
    () =>
      connectedAccounts
        .filter((account) => account.status === "connected")
        .map((account) => account.id)
        .sort()
        .join(","),
    [connectedAccounts],
  );

  useEffect(() => {
    if (!accountsLoaded) return;
    void loadLinkedStorage(connectedAccounts);
  }, [
    accountsLoaded,
    connectedAccountKey,
    filterAccountId,
    cloudFolderId,
    activeFolderId,
    searchQuery,
  ]);

  const selectedAccount = useMemo(
    () => connectedAccounts.find((account) => account.id === filterAccountId),
    [connectedAccounts, filterAccountId],
  );
  const accountFilterOptions = useMemo(() => {
    if (!selectedAccount) return connectedAccounts;
    return connectedAccounts.filter(
      (account) => account.provider === selectedAccount.provider,
    );
  }, [connectedAccounts, selectedAccount]);
  const activeSortLabel =
    FILE_SORT_OPTIONS.find((option) => option.value === activeSort)?.label ??
    "Created (Newest)";

  const displayFolders = useMemo(() => {
    if (activeFolderId || searchQuery) return folders;
    // Nested cloud folder view: show only that folder's children.
    if (cloudFolderId) return linkedFolders;
    const byId = new Map<string, FolderItem>();
    for (const folder of folders) {
      if (folder.id) byId.set(folder.id, folder);
    }
    for (const folder of linkedFolders) {
      if (folder.id && !byId.has(folder.id)) byId.set(folder.id, folder);
    }
    return Array.from(byId.values());
  }, [activeFolderId, searchQuery, cloudFolderId, folders, linkedFolders]);

  const displayFiles = useMemo(() => {
    if (activeFolderId || searchQuery) return files;
    if (cloudFolderId) return linkedFiles;
    const byId = new Map<string, FileItem>();
    for (const file of files) {
      if (file.id) byId.set(file.id, file);
    }
    for (const file of linkedFiles) {
      if (file.id && !byId.has(file.id)) byId.set(file.id, file);
    }
    return Array.from(byId.values());
  }, [activeFolderId, searchQuery, cloudFolderId, files, linkedFiles]);

  const filesByDay = useMemo(() => {
    const groups = new Map<string, FileItem[]>();
    for (const file of displayFiles) {
      const key = formatDate(
        file.updatedAt ?? file.createdAt ?? new Date().toISOString(),
      );
      const list = groups.get(key) ?? [];
      list.push(file);
      groups.set(key, list);
    }
    return Array.from(groups.entries());
  }, [displayFiles]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setContextMenu({ x: 0, y: 0, file: null });
      if (event.key === "Escape")
        setFolderContextMenu({ x: 0, y: 0, folder: null });
      if (event.key === "Escape") setFolderDetailOpen(false);
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
      openMoveForFiles([file]);
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
    const visibleIds = displayFiles
      .map((file) => file.id)
      .filter(Boolean) as string[];
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
    if (event.type === "contextmenu") {
      setFolderContextMenu({ x: event.clientX, y: event.clientY, folder });
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    setFolderContextMenu({
      x: Math.max(12, rect.right - 224),
      y: rect.bottom + 4,
      folder,
    });
  }

  function folderMenuAccount(folder: FolderItem | null) {
    if (!folder?.id) return null;
    if (folder.connectedAccountId) {
      return (
        connectedAccounts.find(
          (account) => account.id === folder.connectedAccountId,
        ) ?? null
      );
    }
    if (isAccountFolderId(folder.id)) {
      const accountId = folder.id.slice(ACCOUNT_FOLDER_PREFIX.length);
      return connectedAccounts.find((account) => account.id === accountId) ?? null;
    }
    if (isLinkedFolderId(folder.id)) {
      const ref = parseLinkedRef(folder.id);
      if (!ref) return null;
      return (
        connectedAccounts.find((account) => account.id === ref.accountId) ??
        null
      );
    }
    return null;
  }

  function goToProviderFolder(folder: FolderItem | null) {
    if (!folder) return;
    const account = folderMenuAccount(folder);
    const providerId =
      folder.providerFolderId ??
      (folder.id && isLinkedFolderId(folder.id)
        ? parseLinkedRef(folder.id)?.providerId
        : null);

    if (account && providerId) {
      const provider = account.provider.toLowerCase();
      if (provider.includes("google") || provider === "drive") {
        window.open(
          `https://drive.google.com/drive/folders/${encodeURIComponent(providerId)}`,
          "_blank",
          "noopener,noreferrer",
        );
        return;
      }
      if (provider.includes("dropbox")) {
        window.open("https://www.dropbox.com/home", "_blank", "noopener,noreferrer");
        return;
      }
      if (provider.includes("onedrive") || provider.includes("microsoft")) {
        window.open(
          "https://onedrive.live.com/",
          "_blank",
          "noopener,noreferrer",
        );
        return;
      }
      if (provider.includes("pcloud")) {
        window.open("https://my.pcloud.com/", "_blank", "noopener,noreferrer");
        return;
      }
    }

    if (isAccountFolderId(folder.id) && account) {
      const provider = account.provider.toLowerCase();
      if (provider.includes("google") || provider === "drive") {
        window.open(
          "https://drive.google.com/drive/my-drive",
          "_blank",
          "noopener,noreferrer",
        );
        return;
      }
    }

    toast.danger(
      `Open in ${account ? providerLabel(account.provider) : "provider"} is not available for this folder.`,
    );
  }

  function folderActionNotSupported(action: string) {
    toast.danger(`${action} is only available for Archive Cloud folders.`);
  }

  function openFolder(folder: FolderItem) {
    if (!folder.id) return;

    if (isAccountFolderId(folder.id)) {
      const accountId = folder.id.slice(ACCOUNT_FOLDER_PREFIX.length);
      patchHomeParams({
        accountId,
        cloudFolder: null,
        folderId: null,
      });
      return;
    }

    if (isLinkedFolderId(folder.id)) {
      const ref = parseLinkedRef(folder.id);
      if (!ref) return;
      // Open this provider folder inside Archive Cloud (not the whole cloud root / external site).
      patchHomeParams({
        accountId: ref.accountId,
        cloudFolder: ref.providerId,
        folderId: null,
      });
      return;
    }

    setFolderSearchParams(
      searchQuery
        ? { folderId: folder.id, q: searchQuery }
        : { folderId: folder.id },
    );
  }

  function openFolderById(folderId: string) {
    if (isAccountFolderId(folderId) || isLinkedFolderId(folderId)) {
      openFolder({
        id: folderId,
        name: "",
        color: defaultFolderColor,
        updated: "",
      });
      return;
    }
    setFolderSearchParams(
      searchQuery ? { folderId, q: searchQuery } : { folderId },
    );
  }

  function openCloudBreadcrumb(providerFolderId: string | null) {
    if (!filterAccountId) return;
    patchHomeParams({
      accountId: filterAccountId,
      cloudFolder: providerFolderId,
      folderId: null,
    });
  }

  function openEmptyContextMenu(event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    setEmptyContextMenu({ x: event.clientX, y: event.clientY, open: true });
  }

  function closeFolder() {
    if (cloudFolderId || (filterAccountId && !activeFolderId)) {
      patchHomeParams({
        accountId: null,
        cloudFolder: null,
        folderId: null,
      });
      return;
    }
    setFolderSearchParams(searchQuery ? { q: searchQuery } : {});
  }

  async function _viewFile() {
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
      if (isLinkedFileId(file.id)) {
        const accountId = file.connectedAccountId;
        const providerFileId = file.providerFileId;
        if (!accountId || !providerFileId) {
          throw new Error("Linked file is missing account details.");
        }
        setPreviewUrl(
          `${API_URL}/connected-accounts/${accountId}/files/${encodeURIComponent(providerFileId)}/preview`,
        );
        return;
      }

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
    const nextName = renameValue.trim();
    if (!nextName || nextName.length > MAX_RENAME_LENGTH) return;
    try {
      await apiFetch(`/files/${activeFile.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: nextName }),
      });
      setRenameOpen(false);
      toast.success("File renamed.");
      await loadFiles();
    } catch (error) {
      toast.danger(
        error instanceof Error ? error.message : "Failed to rename file",
      );
    }
  }

  function openMoveForFiles(filesToMove: FileItem[]) {
    const ids = filesToMove.map((file) => file.id).filter(Boolean) as string[];
    if (ids.length === 0) return;

    // If every file is a linked provider item from the same account, move in-cloud.
    const linked = filesToMove.filter((file) => file.id && isLinkedFileId(file.id));
    if (linked.length === filesToMove.length) {
      const accountId = linked[0]?.connectedAccountId;
      const providerId = linked[0]?.providerFileId;
      if (
        accountId &&
        providerId &&
        linked.every(
          (file) =>
            file.connectedAccountId === accountId && Boolean(file.providerFileId),
        )
      ) {
        if (linked.length > 1) {
          toast.danger("Move one linked cloud file at a time.");
          return;
        }
        setMoveSource({
          kind: "linked",
          accountId,
          providerId: providerId,
        });
        setMoveItemName(linked[0]?.name ?? "file");
        setMoveOpen(true);
        return;
      }
    }

    const archiveIds = filesToMove
      .filter((file) => file.id && !isLinkedFileId(file.id))
      .map((file) => file.id!) ;
    if (archiveIds.length === 0) {
      toast.danger("These items cannot be moved here yet.");
      return;
    }
    setMoveSource({ kind: "archive-files", fileIds: archiveIds });
    setMoveItemName(
      archiveIds.length > 1
        ? `${archiveIds.length} files`
        : (filesToMove[0]?.name ?? "file"),
    );
    setMoveOpen(true);
  }

  function openMoveForFolder(folder: FolderItem) {
    if (!folder.id) return;
    if (isAccountFolderId(folder.id)) {
      folderActionNotSupported("Move");
      return;
    }
    if (isLinkedFolderId(folder.id)) {
      const ref = parseLinkedRef(folder.id);
      if (!ref) {
        folderActionNotSupported("Move");
        return;
      }
      setMoveSource({
        kind: "linked",
        accountId: ref.accountId,
        providerId: ref.providerId,
      });
      setMoveItemName(folder.name);
      setMoveOpen(true);
      return;
    }
    setMoveSource({ kind: "archive-folder", folderId: folder.id });
    setMoveItemName(folder.name);
    setMoveOpen(true);
  }

  function moveExcludeFolderIds(folderId: string) {
    const excluded = new Set<string>([folderId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const folder of allFolders) {
        if (
          folder.id &&
          folder.parentId &&
          excluded.has(folder.parentId) &&
          !excluded.has(folder.id)
        ) {
          excluded.add(folder.id);
          changed = true;
        }
      }
    }
    return excluded;
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

  async function _toggleStar() {
    if (!activeFile?.id) return;
    await updateFilesMetadata([activeFile.id], {
      isStarred: !activeFile.isStarred,
    });
    setContextMenu({ x: 0, y: 0, file: null });
    await loadFiles();
  }

  async function _toggleArchive() {
    if (!activeFile?.id) return;
    await updateFilesMetadata([activeFile.id], {
      isArchived: !activeFile.isArchived,
    });
    setContextMenu({ x: 0, y: 0, file: null });
    await loadFiles();
    window.dispatchEvent(new Event("archivecloud:storage-changed"));
  }

  function shareFile(fileOverride?: FileItem | null) {
    const target = fileOverride ?? activeFile;
    if (!target?.id) return;
    if (fileOverride) setActiveFile(fileOverride);
    setShareOpen(true);
    setContextMenu({ x: 0, y: 0, file: null });
  }

  async function goToGoogleDrive(fileOverride?: FileItem | null) {
    const target = fileOverride ?? activeFile;
    if (!target?.id) return;
    try {
      const data = await apiFetch<{ url: string | null }>(
        `/files/${encodeURIComponent(target.id)}/view-url`,
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

  function resolveVirtualFolderTargetFromFile(
    file: FileItem,
  ): AddToVirtualFolderTarget | null {
    if (!file.connectedAccountId || !file.providerFileId) return null;
    return {
      kind: "file",
      name: file.name,
      connectedAccountId: file.connectedAccountId,
      providerItemId: file.providerFileId,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes ?? 0,
    };
  }

  function resolveVirtualFolderTargetFromFolder(
    folder: FolderItem,
  ): AddToVirtualFolderTarget | null {
    let accountId = folder.connectedAccountId ?? null;
    let providerId = folder.providerFolderId ?? null;

    if ((!accountId || !providerId) && folder.id && isLinkedFolderId(folder.id)) {
      const parsed = parseLinkedRef(folder.id);
      if (parsed) {
        accountId = accountId ?? parsed.accountId;
        providerId = providerId ?? parsed.providerId;
      }
    }

    if (!accountId || !providerId) return null;
    return {
      kind: "folder",
      name: folder.name,
      connectedAccountId: accountId,
      providerItemId: providerId,
      mimeType: "application/vnd.archivecloud.folder",
      sizeBytes: 0,
    };
  }

  function openAddToVirtualFolder(fileOverride?: FileItem | null) {
    const targetFile = fileOverride ?? activeFile;
    if (!targetFile?.id) return;
    if (fileOverride) setActiveFile(fileOverride);
    setContextMenu({ x: 0, y: 0, file: null });

    const target = resolveVirtualFolderTargetFromFile(targetFile);
    if (!target) {
      toast.danger(
        "This file cannot be added to a virtual folder yet.",
      );
      return;
    }
    setVirtualFolderTarget(target);
    setVirtualFolderOpen(true);
  }

  function openAddFolderToVirtualFolder(folder?: FolderItem | null) {
    const targetFolder = folder ?? activeFolderForMenu;
    if (!targetFolder?.id) return;
    setFolderContextMenu({ x: 0, y: 0, folder: null });

    if (isAccountFolderId(targetFolder.id)) {
      toast.danger(
        "Connect into a folder first — whole accounts cannot be added to a virtual folder.",
      );
      return;
    }

    const target = resolveVirtualFolderTargetFromFolder(targetFolder);
    if (!target) {
      toast.danger(
        "This folder cannot be added to a virtual folder yet.",
      );
      return;
    }
    setVirtualFolderTarget(target);
    setVirtualFolderOpen(true);
  }

  async function copyShareLinkDirect(fileOverride?: FileItem | null) {
    const target = fileOverride ?? activeFile;
    if (!target?.id) return;
    if (fileOverride) setActiveFile(fileOverride);
    try {
      const encodedId = encodeURIComponent(target.id);
      const data = await apiFetch<{ url: string | null }>(
        `/files/${encodedId}/view-url`,
      );
      if (data.url) {
        await navigator.clipboard.writeText(data.url);
        toast.success("Google Drive link copied to clipboard!");
      } else {
        const shareData = await apiFetch<{ url: string }>(
          `/files/${encodedId}/share`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              rotate: true,
              name: target.name,
              mimeType: target.mimeType,
              sizeBytes: target.sizeBytes,
            }),
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

  async function _inviteToFile() {
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

  async function renameFolder(event: FormEvent) {
    event.preventDefault();
    const folder = activeFolderForMenu;
    if (!folder?.id) return;

    const nextName = folderRenameValue.trim();
    if (!nextName || nextName.length > MAX_RENAME_LENGTH) return;

    try {
      if (isLinkedFolderId(folder.id)) {
        const ref = parseLinkedRef(folder.id);
        if (!ref) {
          folderActionNotSupported("Rename");
          return;
        }
        await apiFetch(
          `/connected-accounts/${ref.accountId}/items/${encodeURIComponent(ref.providerId)}`,
          {
            method: "PATCH",
            body: JSON.stringify({ name: nextName }),
          },
        );
        setFolderRenameOpen(false);
        toast.success("Folder renamed.");
        await Promise.all([
          loadFolders(),
          loadLinkedStorage(connectedAccounts),
        ]);
        return;
      }

      if (isAccountFolderId(folder.id)) {
        folderActionNotSupported("Rename");
        return;
      }

      await apiFetch(`/folders/${folder.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: nextName,
          color: folderRenameColor,
        }),
      });
      setFolderRenameOpen(false);
      toast.success("Folder renamed.");
      await loadFolders();
    } catch (error) {
      toast.danger(
        error instanceof Error ? error.message : "Failed to rename folder",
      );
    }
  }

  async function deleteFolder() {
    const folder = activeFolderForMenu;
    if (!folder?.id) return;

    try {
      if (isAccountFolderId(folder.id)) {
        toast.danger("Remove is not available for cloud account shortcuts.");
        return;
      }

      if (isLinkedFolderId(folder.id)) {
        const account =
          folderMenuAccount(folder) ??
          (() => {
            const ref = parseLinkedRef(folder.id!);
            return ref
              ? connectedAccounts.find((item) => item.id === ref.accountId)
              : null;
          })();
        const providerId =
          folder.providerFolderId ?? parseLinkedRef(folder.id)?.providerId;
        if (!account || !providerId) {
          throw new Error("Missing cloud account details for this folder.");
        }
        await apiFetch(
          `/connected-accounts/${account.id}/items/${encodeURIComponent(providerId)}`,
          { method: "DELETE" },
        );
        setFolderDeleteOpen(false);
        toast.success(`Deleted "${folder.name}".`);
        await loadLinkedStorage(connectedAccounts);
        if (!cloudFolderId) await loadFolders();
        return;
      }

      await apiFetch(`/folders/${folder.id}`, { method: "DELETE" });
      setFolderDeleteOpen(false);
      toast.success(`Deleted "${folder.name}".`);
      await loadFolders();
      if (activeFolderId === folder.id) {
        closeFolder();
      }
    } catch (error) {
      toast.danger(
        error instanceof Error ? error.message : "Failed to delete folder",
      );
    }
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
  const isCloudFolderView = Boolean(
    cloudFolderId && filterAccountId && !activeFolderId,
  );
  const cloudPathCrumbs = useMemo(() => {
    if (!isCloudFolderView) return [];
    return linkedBreadcrumbs.filter(
      (crumb) => crumb.id && crumb.id !== "root" && crumb.id !== "0",
    );
  }, [isCloudFolderView, linkedBreadcrumbs]);
  const showFolderTrail = Boolean(activeFolder) || isCloudFolderView;
  const allVisibleSelected =
    displayFiles.length > 0 &&
    displayFiles.every((file) => file.id && selectedFileIds.has(file.id));
  const activePreviewKind = getPreviewKind(
    activeFile?.mimeType,
    activeFile?.name,
  );
  const previewImageFiles = useMemo(
    () =>
      displayFiles.filter(
        (file) => getPreviewKind(file.mimeType, file.name) === "image",
      ),
    [displayFiles],
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
          <>
            <PageHeader
              title={homeGreeting}
              description={CONNECT_ONBOARDING_DESCRIPTION}
            />
            <NoConnectedAccountsEmptyStateSkeleton />
          </>
        ) : showConnectOnboarding ? (
          <>
            <PageHeader
              title={homeGreeting}
              description={CONNECT_ONBOARDING_DESCRIPTION}
            />
            <NoConnectedAccountsEmptyState
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
          </>
        ) : (
          <>
            <PageHeader
              title={
                showFolderTrail ? (
                  <span className="block min-w-0 truncate">
                    <button
                      type="button"
                      className="text-foreground hover:underline"
                      onClick={closeFolder}
                    >
                      Home
                    </button>
                    {activeFolder
                      ? folderBreadcrumbs.map((folder, index) => (
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
                        ))
                      : null}
                    {isCloudFolderView && selectedAccount ? (
                      <>
                        <span className="text-muted"> / </span>
                        <button
                          type="button"
                          className="text-foreground hover:underline"
                          onClick={() => openCloudBreadcrumb(null)}
                        >
                          {accountTitle(selectedAccount)}
                        </button>
                        {cloudPathCrumbs.map((crumb, index) => (
                          <span key={`${crumb.id}-${index}`}>
                            <span className="text-muted"> / </span>
                            {index === cloudPathCrumbs.length - 1 ? (
                              <span>{crumb.name}</span>
                            ) : (
                              <button
                                type="button"
                                className="text-foreground hover:underline"
                                onClick={() => openCloudBreadcrumb(crumb.id)}
                              >
                                {crumb.name}
                              </button>
                            )}
                          </span>
                        ))}
                      </>
                    ) : null}
                  </span>
                ) : (
                  homeGreeting
                )
              }
              actions={
                <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
                  {!isCloudFolderView ? (
                  <Popover
                    isOpen={accountFilterOpen}
                    onOpenChange={setAccountFilterOpen}
                  >
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
                    <Popover.Content className="w-72 p-1.5">
                      <Popover.Dialog>
                        <button
                          type="button"
                          className={cn(
                            "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm",
                            !filterAccountId
                              ? "bg-primary/10 font-semibold text-primary"
                              : "font-medium text-foreground hover:bg-black/5",
                          )}
                          onClick={() => {
                            setAccountFilterOpen(false);
                            patchHomeParams({
                              accountId: null,
                              cloudFolder: null,
                              folderId: null,
                            });
                          }}
                        >
                          All Accounts
                        </button>
                        {accountFilterOptions.map((account) => {
                          const email = account.email?.trim();
                          const showEmail =
                            Boolean(email) &&
                            (selectedAccount
                              ? accountFilterOptions.length > 1
                              : connectedAccounts.filter(
                                  (item) => item.provider === account.provider,
                                ).length > 1);
                          return (
                            <button
                              key={account.id}
                              type="button"
                              className={cn(
                                "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm",
                                filterAccountId === account.id
                                  ? "bg-primary/10 font-semibold text-primary"
                                  : "font-medium text-foreground hover:bg-black/5",
                              )}
                              onClick={() => {
                                setAccountFilterOpen(false);
                                patchHomeParams({
                                  accountId: account.id,
                                  cloudFolder: null,
                                  folderId: null,
                                });
                              }}
                            >
                              <AccountProviderIcon
                                provider={account.provider}
                              />
                              <span className="min-w-0 flex-1 overflow-hidden">
                                <span className="block truncate">
                                  {accountTitle(account)}
                                </span>
                                {showEmail ? (
                                  <span
                                    className={cn(
                                      "mt-0.5 block truncate text-[11px] font-normal",
                                      filterAccountId === account.id
                                        ? "text-primary/80"
                                        : "text-muted",
                                    )}
                                  >
                                    {email}
                                  </span>
                                ) : null}
                              </span>
                            </button>
                          );
                        })}
                      </Popover.Dialog>
                    </Popover.Content>
                  </Popover>
                  ) : null}

                  <Popover
                    isOpen={sortFilterOpen}
                    onOpenChange={setSortFilterOpen}
                  >
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
                            onClick={() => {
                              setSortFilterOpen(false);
                              patchHomeParams({
                                sort:
                                  option.value === "created_desc"
                                    ? null
                                    : option.value,
                              });
                            }}
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
            {!activeFolder && !isCloudFolderView ? (
              <SuggestedSection
                title="Suggested folders"
                variant="plain"
                open={suggestedFoldersOpen}
                onOpenChange={setSuggestedFoldersOpen}
              >
                {displayFolders.length > 0 ? (
                  <FolderGrid
                    items={displayFolders}
                    mobileTwoColumns
                    sizeScale="xs"
                    onFolderMenu={openFolderMenu}
                    onFolderOpen={openFolder}
                    onDropItem={handleDropItem}
                  />
                ) : (
                  <div className="flex min-h-[160px] items-center justify-center py-6">
                    <p className="text-center text-sm text-muted">
                      {linkedLoading
                        ? "Loading folders from linked storage..."
                        : connectedAccounts.some(
                              (account) => account.status === "connected",
                            )
                          ? filterAccountId
                            ? "No folders in this cloud root yet."
                            : "No folders yet. Use Add New in the sidebar or open a linked cloud from the account filter."
                          : "No folders yet. Use Add New in the sidebar or right-click to create one."}
                    </p>
                  </div>
                )}
              </SuggestedSection>
            ) : displayFolders.length > 0 ? (
              <SuggestedSection
                title="Folders"
                variant="plain"
                open={suggestedFoldersOpen}
                onOpenChange={setSuggestedFoldersOpen}
              >
                <FolderGrid
                  items={displayFolders}
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
                            const file = displayFiles.find(
                              (item) => item.id === id,
                            );
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
                            const file = displayFiles.find(
                              (item) => item.id === id,
                            );
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
                      onClick={() => {
                        const selected = displayFiles.filter(
                          (file) => file.id && selectedFileIds.has(file.id),
                        );
                        openMoveForFiles(selected);
                      }}
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
                          const file = displayFiles.find(
                            (item) => item.id === id,
                          );
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
              title={
                activeFolder || isCloudFolderView ? "Files" : "Suggested files"
              }
              variant="plain"
              open={suggestedFilesOpen}
              onOpenChange={setSuggestedFilesOpen}
            >
              {displayFiles.length === 0 ? (
                <div className="flex min-h-[160px] items-center justify-center py-6">
                  <p className="text-center text-sm text-muted">
                    {searchQuery
                      ? `No files found for "${searchQuery}".`
                      : activeFolder || isCloudFolderView
                        ? "No files in this folder yet."
                        : linkedLoading
                          ? "Loading files from linked storage..."
                          : filterAccountId
                            ? "No files in this cloud root yet. Open a folder above or Upload a file."
                            : connectedAccounts.some(
                                  (account) => account.status === "connected",
                                )
                              ? "Open a linked cloud folder above to browse files, or Upload a file into Archive Cloud."
                              : "No uploaded files yet. Connect a cloud account, then Sync or upload a file."}
                  </p>
                </div>
              ) : fileViewMode === "grid" ? (
                <FileGrid
                  files={displayFiles}
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
                  files={displayFiles}
                  selectedFileIds={selectedFileIds}
                  allSelected={allVisibleSelected}
                  onToggleFile={toggleFileSelection}
                  onToggleAll={toggleAllVisibleFiles}
                  onFileContextMenu={openContext}
                />
              )}
              {filesNextCursor ? (
                <div className="mt-4 flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    isDisabled={filesLoadingMore}
                    onPress={() =>
                      loadFiles(filesNextCursor).catch((error) =>
                        toast.danger(
                          error instanceof Error
                            ? error.message
                            : "Failed to load more files",
                        ),
                      )
                    }
                  >
                    {filesLoadingMore ? "Loading…" : "Load more"}
                  </Button>
                </div>
              ) : null}
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
        goToDriveLabel={(() => {
          const provider =
            activeFile?.accountProvider ??
            connectedAccounts.find(
              (item) => item.id === activeFile?.connectedAccountId,
            )?.provider;
          return provider ? `Go to ${providerLabel(provider)}` : "Go to Drive";
        })()}
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
          if (selectedFileIds.size > 0) {
            const selected = displayFiles.filter(
              (file) => file.id && selectedFileIds.has(file.id),
            );
            openMoveForFiles(selected);
          } else if (activeFile) {
            openMoveForFiles([activeFile]);
          }
          setContextMenu({ x: 0, y: 0, file: null });
        }}
        onRemove={() => {
          setDeleteOpen(true);
          setContextMenu({ x: 0, y: 0, file: null });
        }}
        onManageTags={() => {
          if (activeFile?.id) {
            setManageTagsTarget({
              kind: "file",
              id: activeFile.id,
              name: activeFile.name ?? "",
            });
            setManageTagsOpen(true);
          }
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
        goToDriveLabel={
          folderMenuAccount(folderContextMenu.folder)
            ? `Go to ${providerLabel(folderMenuAccount(folderContextMenu.folder)!.provider)}`
            : "Go to Drive"
        }
        onClose={() => setFolderContextMenu({ x: 0, y: 0, folder: null })}
        onDetails={() => {
          if (!activeFolderForMenu) return;
          setFolderDetailOpen(true);
        }}
        onOpen={() => {
          if (activeFolderForMenu) openFolder(activeFolderForMenu);
        }}
        onGoToDrive={() => {
          goToProviderFolder(activeFolderForMenu);
        }}
        onRename={() => {
          const folder = activeFolderForMenu;
          if (!folder?.id) return;
          if (isAccountFolderId(folder.id)) {
            folderActionNotSupported("Rename");
            return;
          }
          setFolderRenameValue(folder.name ?? "");
          setFolderRenameColor(normalizeFolderColor(folder.color));
          setFolderRenameOpen(true);
        }}
        onDownload={() => {
          folderActionNotSupported("Download");
        }}
        onMove={() => {
          const folder = activeFolderForMenu;
          if (!folder?.id) return;
          openMoveForFolder(folder);
        }}
        onRemove={() => {
          const folder = activeFolderForMenu;
          if (!folder?.id) return;
          if (isAccountFolderId(folder.id)) {
            folderActionNotSupported("Remove");
            return;
          }
          setFolderDeleteOpen(true);
        }}
        onManageTags={() => {
          const folder = activeFolderForMenu;
          if (!folder?.id) return;
          setManageTagsTarget({
            kind: "folder",
            id: folder.id,
            name: folder.name ?? "",
          });
          setManageTagsOpen(true);
        }}
        onAddToVirtualFolder={() => {
          openAddFolderToVirtualFolder();
        }}
      />
      <FileDetailsDrawer
        open={detailOpen}
        file={activeFile}
        onClose={() => setDetailOpen(false)}
        onOpenFile={() => {
          if (!activeFile) return;
          setDetailOpen(false);
          void openFilePreview(activeFile);
        }}
      />
      <FolderDetailsDrawer
        open={folderDetailOpen}
        details={
          activeFolderForMenu
            ? {
                folder: activeFolderForMenu,
                provider: folderMenuAccount(activeFolderForMenu)?.provider,
                accountName: folderMenuAccount(activeFolderForMenu)
                  ? accountTitle(folderMenuAccount(activeFolderForMenu)!)
                  : "Archive Cloud",
                owner: "You",
                modified: activeFolderForMenu.updated || null,
                mimeType: null,
              }
            : null
        }
        onClose={() => setFolderDetailOpen(false)}
        onOpenFolder={() => {
          if (!activeFolderForMenu) return;
          setFolderDetailOpen(false);
          openFolder(activeFolderForMenu);
        }}
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
        onClose={() => setRenameOpen(false)}
      >
        <form onSubmit={renameFile} className="grid gap-5">
          <label
            htmlFor="rename-file-name"
            className="grid gap-2 text-sm font-semibold"
          >
            <span>
              File Name <span className="text-danger">*</span>
            </span>
            <Input
              id="rename-file-name"
              fullWidth
              value={renameValue}
              maxLength={MAX_RENAME_LENGTH}
              onChange={(event) => setRenameValue(event.target.value)}
              autoFocus
              required
            />
            <span className="text-xs font-normal text-muted">
              {renameValue.length}/{MAX_RENAME_LENGTH} characters
            </span>
          </label>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRenameOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Rename</Button>
          </div>
        </form>
      </DummyModal>
      <ManageTagsModal
        open={manageTagsOpen}
        target={manageTagsTarget}
        onClose={() => {
          setManageTagsOpen(false);
          setManageTagsTarget(null);
        }}
        onSaved={async () => {
          await loadAll();
        }}
      />
      <MoveDestinationModal
        open={moveOpen}
        itemName={moveItemName}
        source={moveSource}
        accounts={connectedAccounts}
        archiveFolders={allFolders}
        excludeArchiveFolderIds={
          moveSource?.kind === "archive-folder"
            ? moveExcludeFolderIds(moveSource.folderId)
            : undefined
        }
        onClose={() => {
          setMoveOpen(false);
          setMoveSource(null);
          setMoveItemName("");
        }}
        onMoved={async () => {
          clearSelection();
          if (cloudFolderId) {
            await loadLinkedStorage(connectedAccounts);
          } else {
            await loadAll();
            await loadLinkedStorage(connectedAccounts);
          }
        }}
      />
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
      <PublicLinkModal
        open={shareOpen}
        fileId={activeFile?.id ?? null}
        fileName={activeFile?.name ?? ""}
        mimeType={activeFile?.mimeType}
        sizeBytes={activeFile?.sizeBytes}
        onClose={() => setShareOpen(false)}
      />
      <DummyModal
        open={folderRenameOpen}
        title="Rename Folder"
        onClose={() => setFolderRenameOpen(false)}
      >
        <form onSubmit={renameFolder} className="grid gap-5">
          <label
            htmlFor="rename-folder-name"
            className="grid gap-2 text-sm font-semibold"
          >
            <span>
              Folder Name <span className="text-danger">*</span>
            </span>
            <Input
              id="rename-folder-name"
              fullWidth
              value={folderRenameValue}
              maxLength={MAX_RENAME_LENGTH}
              onChange={(event) => setFolderRenameValue(event.target.value)}
              autoFocus
              required
            />
            <span className="text-xs font-normal text-muted">
              {folderRenameValue.length}/{MAX_RENAME_LENGTH} characters
            </span>
          </label>
          {activeFolderForMenu?.id &&
          !isLinkedFolderId(activeFolderForMenu.id) ? (
            <FolderColorFields
              color={folderRenameColor}
              onColorChange={setFolderRenameColor}
            />
          ) : null}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setFolderRenameOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Rename</Button>
          </div>
        </form>
      </DummyModal>
      <DummyModal
        open={folderDeleteOpen}
        title="Delete"
        onClose={() => setFolderDeleteOpen(false)}
      >
        <div className="grid gap-5">
          <div className="grid gap-2">
            <p className="text-sm leading-relaxed text-foreground">
              Are you sure you want to delete{" "}
              <span className="font-extrabold">
                &apos;{activeFolderForMenu?.name ?? "folder"}&apos;
              </span>{" "}
              folder
              {folderMenuAccount(activeFolderForMenu) ? (
                <>
                  {" "}
                  from{" "}
                  <span className="font-extrabold">
                    &apos;
                    {accountTitle(folderMenuAccount(activeFolderForMenu)!)}
                    &apos;
                  </span>
                </>
              ) : (
                <> from Archive Cloud</>
              )}
              ?
            </p>
            <p className="text-sm font-semibold text-amber-600">
              All contents will be deleted permanently.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onPress={() => setFolderDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onPress={() => {
                void deleteFolder();
              }}
            >
              <TrashBin className="h-4 w-4" />
              Delete Folder
            </Button>
          </div>
        </div>
      </DummyModal>
      <AddToVirtualFolderModal
        open={virtualFolderOpen}
        target={virtualFolderTarget}
        onClose={() => {
          setVirtualFolderOpen(false);
          setVirtualFolderTarget(null);
        }}
      />
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
