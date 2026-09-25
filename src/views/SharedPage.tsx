"use client";

import {
  ArrowRotateRight,
  ChevronsExpandVertical,
  Sliders,
} from "@gravity-ui/icons";
import { Button, Popover, toast } from "@heroui/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  SharedNoAccountEmptyState,
  SharedNoAccountEmptyStateSkeleton,
} from "@/components/dashboard/SharedNoAccountEmptyState";
import { FileGrid } from "@/components/drive/FileGrid";
import { FileTable } from "@/components/drive/FileTable";
import { FileViewToggle } from "@/components/drive/FileViewToggle";
import { FolderGrid } from "@/components/drive/FolderGrid";
import { defaultFolderColor } from "@/components/drive/folder-colors";
import { PageHeader } from "@/components/drive/PageHeader";
import {
  FileGridSkeleton,
  FileListSkeleton,
} from "@/components/drive/PageSkeletons";
import { SuggestedSection } from "@/components/drive/SuggestedSection";
import { ProviderBrandIcon } from "@/components/ProviderBrandIcon";
import type { FileItem, FolderItem } from "@/data/drive-data";
import { useFileViewMode } from "@/hooks/useFileViewMode";
import { API_URL, apiFetch, formatBytes, formatDate } from "@/lib/api";
import { type ApiFile, mapApiFileToItem, mimeToKind } from "@/lib/files";
import { providerLabel } from "@/lib/providers";
import { cn } from "@/lib/utils";

type InviteTarget = {
  id: string;
  name: string;
  type: "file" | "folder";
  mimeType?: string;
  sizeBytes?: string;
};

type Invite = {
  id: string;
  email: string;
  role: string;
  status: string;
  targetType: "file" | "folder";
  targetId: string;
  target: InviteTarget | null;
  createdAt: string;
  acceptedAt: string | null;
  user: { id: string; name: string; email: string } | null;
};

type CloudSharedFolder = {
  id: string;
  name: string;
  accountId: string;
  accountEmail: string;
  sharedBy: string | null;
  updatedAt: string | null;
  openUrl: string;
};

type CloudSharedFile = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: string;
  accountId: string;
  accountEmail: string;
  sharedBy: string | null;
  updatedAt: string | null;
  openUrl: string;
};

type SharedLink = {
  id: string;
  url: string | null;
  createdAt: string;
  expiresAt: string | null;
  file: ApiFile;
};

type ConnectedAccount = {
  id: string;
  provider: string;
  email: string;
  displayName?: string | null;
  status: string;
};

type FolderSource =
  | { kind: "cloud"; openUrl: string; accountId: string }
  | { kind: "app"; owned: boolean; accountId?: string };

type FileSource =
  | { kind: "cloud"; openUrl: string; accountId: string }
  | { kind: "app" };

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

function cloudFileToItem(file: CloudSharedFile): FileItem {
  return {
    id: `cloud:${file.id}`,
    name: file.name,
    mimeType: file.mimeType,
    createdAt: file.updatedAt ?? undefined,
    updatedAt: file.updatedAt ?? undefined,
    date: file.updatedAt ? formatDate(file.updatedAt) : "—",
    size: formatBytes(file.sizeBytes),
    sizeBytes: file.sizeBytes,
    access: file.accountEmail,
    kind: mimeToKind(file.mimeType, file.name),
    shared: 1,
    owner: file.sharedBy ? `Shared by ${file.sharedBy}` : "Shared with you",
    accountEmail: file.accountEmail,
    location: "Shared with me",
  };
}

function inviteFileToItem(
  invite: Invite,
  direction: "sent" | "received",
): FileItem | null {
  const target = invite.target;
  if (!target || invite.targetType !== "file") return null;
  const mimeType = target.mimeType ?? "application/octet-stream";
  return {
    id: target.id,
    name: target.name,
    mimeType,
    createdAt: invite.createdAt,
    updatedAt: invite.acceptedAt ?? invite.createdAt,
    date: formatDate(invite.createdAt),
    size: target.sizeBytes ? formatBytes(target.sizeBytes) : "—",
    sizeBytes: target.sizeBytes,
    access:
      direction === "sent"
        ? `Shared with ${invite.email}`
        : `${invite.role} access`,
    kind: mimeToKind(mimeType, target.name),
    shared: 1,
    owner:
      direction === "sent"
        ? `You → ${invite.user?.name || invite.email}`
        : "Shared with you",
    location: "Shared",
    thumbnailUrl: `/files/${target.id}/thumbnail`,
  };
}

function compareFiles(a: FileItem, b: FileItem, sort: FileSort) {
  switch (sort) {
    case "created_asc":
      return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
    case "name_asc":
      return a.name.localeCompare(b.name);
    case "name_desc":
      return b.name.localeCompare(a.name);
    case "size_desc":
      return Number(b.sizeBytes ?? 0) - Number(a.sizeBytes ?? 0);
    case "updated_desc":
      return (b.updatedAt ?? b.createdAt ?? "").localeCompare(
        a.updatedAt ?? a.createdAt ?? "",
      );
    default:
      return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
  }
}

function compareFolders(a: FolderItem, b: FolderItem, sort: FileSort) {
  if (sort === "name_asc") return a.name.localeCompare(b.name);
  if (sort === "name_desc") return b.name.localeCompare(a.name);
  return a.name.localeCompare(b.name);
}

export function SharedPage() {
  const router = useRouter();
  const sp = useSearchParams() ?? new URLSearchParams();
  const filterAccountId = sp.get("accountId")?.trim() ?? "";
  const sortParam = (sp.get("sort") as FileSort | null) ?? "created_desc";
  const activeSort = FILE_SORT_OPTIONS.some(
    (option) => option.value === sortParam,
  )
    ? sortParam
    : "created_desc";

  const [sentInvites, setSentInvites] = useState<Invite[]>([]);
  const [receivedInvites, setReceivedInvites] = useState<Invite[]>([]);
  const [cloudFolders, setCloudFolders] = useState<CloudSharedFolder[]>([]);
  const [cloudFiles, setCloudFiles] = useState<CloudSharedFile[]>([]);
  const [sharedLinks, setSharedLinks] = useState<SharedLink[]>([]);
  const [connectedAccounts, setConnectedAccounts] = useState<
    ConnectedAccount[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [syncingDrive, setSyncingDrive] = useState(false);
  const [viewMode, setViewMode] = useFileViewMode("archivecloud:shared-view");
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [filesOpen, setFilesOpen] = useState(true);
  const [accountFilterOpen, setAccountFilterOpen] = useState(false);
  const [sortFilterOpen, setSortFilterOpen] = useState(false);

  function patchSharedParams(patch: Record<string, string | null | undefined>) {
    const next = new URLSearchParams(sp.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    const qs = next.toString();
    router.push(qs ? `/shared?${qs}` : "/shared");
  }

  async function loadAllShared() {
    setLoading(true);
    try {
      const [invitesData, cloudData, linksData, accountsData] =
        await Promise.all([
          apiFetch<{ sent: Invite[]; received: Invite[] }>("/invites"),
          apiFetch<{
            folders: CloudSharedFolder[];
            files: CloudSharedFile[];
          }>("/shared/cloud-folders"),
          apiFetch<{ shares: SharedLink[] }>("/files/shared-links").catch(
            () => ({ shares: [] as SharedLink[] }),
          ),
          apiFetch<{ accounts: ConnectedAccount[] }>("/connected-accounts"),
        ]);
      setSentInvites(invitesData.sent);
      setReceivedInvites(invitesData.received);
      setCloudFolders(cloudData.folders);
      setCloudFiles(cloudData.files ?? []);
      setSharedLinks(linksData.shares);
      setConnectedAccounts(
        accountsData.accounts.filter(
          (account) => account.status === "connected",
        ),
      );
    } finally {
      setLoading(false);
      setAccountsLoaded(true);
    }
  }

  useEffect(() => {
    loadAllShared().catch((error) =>
      toast.danger(
        error instanceof Error
          ? error.message
          : "Failed to load shared resources",
      ),
    );
    const onInvitesChanged = () => {
      loadAllShared().catch(() => undefined);
    };
    window.addEventListener("archivecloud:invites-changed", onInvitesChanged);
    return () =>
      window.removeEventListener(
        "archivecloud:invites-changed",
        onInvitesChanged,
      );
  }, []);

  const selectedAccount = useMemo(
    () => connectedAccounts.find((account) => account.id === filterAccountId),
    [connectedAccounts, filterAccountId],
  );
  const activeSortLabel =
    FILE_SORT_OPTIONS.find((option) => option.value === activeSort)?.label ??
    "Created (Newest)";

  const { folders, files, folderSources, fileSources } = useMemo(() => {
    const folderMap = new Map<string, FolderItem>();
    const fileMap = new Map<string, FileItem>();
    const sources = new Map<string, FolderSource>();
    const fileSrc = new Map<string, FileSource>();
    const accountEmailById = new Map(
      connectedAccounts.map((account) => [account.id, account.email]),
    );
    const accountIdByEmail = new Map(
      connectedAccounts.map((account) => [account.email, account.id]),
    );

    const filteredCloudFolders = filterAccountId
      ? cloudFolders.filter((folder) => folder.accountId === filterAccountId)
      : cloudFolders;
    const filteredCloudFiles = filterAccountId
      ? cloudFiles.filter((file) => file.accountId === filterAccountId)
      : cloudFiles;

    for (const folder of filteredCloudFolders) {
      const id = `cloud:${folder.id}`;
      folderMap.set(id, {
        id,
        name: folder.name,
        updated: folder.sharedBy
          ? `Shared by ${folder.sharedBy}`
          : folder.updatedAt
            ? formatDate(folder.updatedAt)
            : "Shared on Google Drive",
        color: defaultFolderColor,
      });
      sources.set(id, {
        kind: "cloud",
        openUrl: folder.openUrl,
        accountId: folder.accountId,
      });
    }

    for (const file of filteredCloudFiles) {
      const item = cloudFileToItem(file);
      if (!item.id) continue;
      fileMap.set(item.id, item);
      fileSrc.set(item.id, {
        kind: "cloud",
        openUrl: file.openUrl,
        accountId: file.accountId,
      });
    }

    for (const invite of receivedInvites) {
      if (invite.targetType === "folder" && invite.target) {
        const id = invite.target.id;
        if (!folderMap.has(id)) {
          folderMap.set(id, {
            id,
            name: invite.target.name,
            updated: `${invite.role} · ${formatDate(invite.createdAt)}`,
            color: defaultFolderColor,
          });
          sources.set(id, { kind: "app", owned: false });
        }
      }
      const file = inviteFileToItem(invite, "received");
      if (file?.id && !fileMap.has(file.id)) {
        fileMap.set(file.id, file);
        fileSrc.set(file.id, { kind: "app" });
      }
    }

    for (const invite of sentInvites) {
      if (invite.targetType === "folder" && invite.target) {
        const id = invite.target.id;
        if (!folderMap.has(id)) {
          folderMap.set(id, {
            id,
            name: invite.target.name,
            updated: `Shared with ${invite.email}`,
            color: defaultFolderColor,
          });
          sources.set(id, { kind: "app", owned: true });
        } else {
          const existing = folderMap.get(id);
          if (existing && sources.get(id)?.kind === "app") {
            folderMap.set(id, {
              ...existing,
              updated: "Shared with others",
            });
            sources.set(id, { kind: "app", owned: true });
          }
        }
      }
      const file = inviteFileToItem(invite, "sent");
      if (file?.id) {
        const existing = fileMap.get(file.id);
        if (!existing) {
          fileMap.set(file.id, file);
          fileSrc.set(file.id, { kind: "app" });
        } else if (!existing.owner?.startsWith("You")) {
          fileMap.set(file.id, {
            ...existing,
            owner: file.owner,
            access: file.access,
          });
        }
      }
    }

    for (const share of sharedLinks) {
      const item = mapApiFileToItem(share.file);
      if (!item.id) continue;
      const shareAccountId = share.file.connectedAccount?.email
        ? accountIdByEmail.get(share.file.connectedAccount.email)
        : undefined;
      if (
        filterAccountId &&
        shareAccountId &&
        shareAccountId !== filterAccountId
      ) {
        continue;
      }
      if (
        filterAccountId &&
        !shareAccountId &&
        share.file.connectedAccount?.email &&
        share.file.connectedAccount.email !==
          accountEmailById.get(filterAccountId)
      ) {
        continue;
      }

      if (!fileMap.has(item.id)) {
        fileMap.set(item.id, {
          ...item,
          owner: "You (public link)",
          access: "Public link",
          location: "Shared",
        });
        fileSrc.set(item.id, { kind: "app" });
      } else {
        const existing = fileMap.get(item.id);
        if (existing) {
          fileMap.set(item.id, {
            ...existing,
            owner: existing.owner?.startsWith("You")
              ? existing.owner
              : "You (public link)",
            access: existing.access.includes("Shared")
              ? existing.access
              : "Public link",
          });
        }
      }
    }

    const nextFolders = [...folderMap.values()].sort((a, b) =>
      compareFolders(a, b, activeSort),
    );
    const nextFiles = [...fileMap.values()].sort((a, b) =>
      compareFiles(a, b, activeSort),
    );

    return {
      folders: nextFolders,
      files: nextFiles,
      folderSources: sources,
      fileSources: fileSrc,
    };
  }, [
    activeSort,
    cloudFiles,
    cloudFolders,
    connectedAccounts,
    filterAccountId,
    receivedInvites,
    sentInvites,
    sharedLinks,
  ]);

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

  function openFolder(folder: FolderItem) {
    if (!folder.id) return;
    const source = folderSources.get(folder.id);
    if (source?.kind === "cloud") {
      window.open(source.openUrl, "_blank", "noopener");
      return;
    }
    router.push(`/home?folderId=${encodeURIComponent(folder.id)}`);
  }

  async function openFile(file: FileItem) {
    if (!file.id) return;
    const source = fileSources.get(file.id);
    if (source?.kind === "cloud") {
      window.open(source.openUrl, "_blank", "noopener");
      return;
    }
    try {
      const data = await apiFetch<{ path?: string; url: string }>(
        `/files/${file.id}/preview-token`,
        { method: "POST" },
      );
      const previewPath = data.path ?? new URL(data.url).pathname;
      window.open(`${API_URL}${previewPath}`, "_blank", "noopener");
    } catch (error) {
      toast.danger(
        error instanceof Error ? error.message : "Unable to open this file",
      );
    }
  }

  async function syncGoogleDrive() {
    setSyncingDrive(true);
    try {
      const response = await apiFetch<{
        results: { created: number; updated: number; deleted: number }[];
      }>("/files/sync-google", { method: "POST", body: JSON.stringify({}) });

      let created = 0;
      let updated = 0;
      let deleted = 0;
      for (const res of response.results) {
        created += res.created;
        updated += res.updated;
        deleted += res.deleted;
      }
      const accounts = response.results.length;

      toast.success(
        `Google Drive synced. ${created} added, ${updated} updated, ${deleted} removed across ${accounts} account${accounts === 1 ? "" : "s"}.`,
      );
      await loadAllShared();
      window.dispatchEvent(new Event("archivecloud:storage-changed"));
    } catch (error) {
      toast.danger(
        error instanceof Error ? error.message : "Failed to sync Google Drive",
      );
    } finally {
      setSyncingDrive(false);
    }
  }

  const showNoAccountEmpty = accountsLoaded && connectedAccounts.length === 0;
  const showNoAccountSkeleton = !accountsLoaded;

  return (
    <div className="min-h-0 w-full min-w-0 sm:min-h-[620px]">
      <PageHeader
        title="Shared with me"
        mobileSearchEnd={
          showNoAccountEmpty || showNoAccountSkeleton ? undefined : (
            <Button
              size="sm"
              variant="outline"
              isIconOnly
              className="h-9 w-9 shrink-0 rounded-lg sm:h-10 sm:w-10 sm:rounded-xl"
              aria-label={syncingDrive ? "Syncing" : "Sync"}
              isDisabled={syncingDrive}
              onPress={() => syncGoogleDrive().catch(() => undefined)}
            >
              <ArrowRotateRight
                className={
                  syncingDrive
                    ? "h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4"
                    : "h-3.5 w-3.5 sm:h-4 sm:w-4"
                }
              />
            </Button>
          )
        }
        actions={
          showNoAccountEmpty || showNoAccountSkeleton ? (
            <FileViewToggle mode={viewMode} onChange={setViewMode} />
          ) : (
            <div className="flex w-full max-w-full flex-wrap items-center gap-1.5 sm:w-auto sm:justify-end sm:gap-2">
              <Popover
                isOpen={accountFilterOpen}
                onOpenChange={setAccountFilterOpen}
              >
                <Popover.Trigger className="inline-flex h-9 min-w-0 flex-[1_1_9rem] cursor-pointer items-center justify-between gap-1.5 rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-foreground shadow-sm sm:h-10 sm:min-w-[9.5rem] sm:max-w-[12rem] sm:flex-none sm:gap-2 sm:rounded-xl sm:px-3 sm:text-sm">
                  <span className="flex min-w-0 items-center gap-1.5 sm:gap-2">
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
                      onClick={() => {
                        setAccountFilterOpen(false);
                        patchSharedParams({ accountId: null });
                      }}
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
                        onClick={() => {
                          setAccountFilterOpen(false);
                          patchSharedParams({ accountId: account.id });
                        }}
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

              <Popover isOpen={sortFilterOpen} onOpenChange={setSortFilterOpen}>
                <Popover.Trigger className="inline-flex h-9 min-w-0 flex-[1_1_9rem] cursor-pointer items-center justify-between gap-1.5 rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-foreground shadow-sm sm:h-10 sm:min-w-[10rem] sm:max-w-[13rem] sm:flex-none sm:gap-2 sm:rounded-xl sm:px-3 sm:text-sm">
                  <span className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                    <Sliders className="h-3.5 w-3.5 shrink-0 text-muted sm:h-4 sm:w-4" />
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
                          patchSharedParams({
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
                className="hidden h-10 lg:inline-flex"
                isDisabled={syncingDrive}
                onPress={() => syncGoogleDrive().catch(() => undefined)}
              >
                <ArrowRotateRight
                  className={syncingDrive ? "h-4 w-4 animate-spin" : "h-4 w-4"}
                />
                {syncingDrive ? "Syncing..." : "Sync"}
              </Button>

              <FileViewToggle mode={viewMode} onChange={setViewMode} />
            </div>
          )
        }
      />

      {showNoAccountSkeleton ? (
        <SharedNoAccountEmptyStateSkeleton />
      ) : showNoAccountEmpty ? (
        <SharedNoAccountEmptyState
          onConnected={() => {
            void loadAllShared().catch(() => undefined);
          }}
        />
      ) : (
        <>
          <SuggestedSection
            title="Folders"
            variant="plain"
            open={foldersOpen}
            onOpenChange={setFoldersOpen}
          >
            {loading ? (
              <FileGridSkeleton count={4} label="Loading folders" />
            ) : folders.length > 0 ? (
              <FolderGrid
                items={folders}
                mobileTwoColumns
                sizeScale="xs"
                onFolderOpen={openFolder}
              />
            ) : (
              <div className="flex min-h-[160px] items-center justify-center py-6">
                <p className="text-center text-sm text-muted">
                  No shared folders yet.
                </p>
              </div>
            )}
          </SuggestedSection>

          <SuggestedSection
            title="Files"
            variant="plain"
            open={filesOpen}
            onOpenChange={setFilesOpen}
          >
            {loading ? (
              viewMode === "grid" || viewMode === "calendar" ? (
                <FileGridSkeleton label="Loading files" />
              ) : (
                <FileListSkeleton label="Loading files" />
              )
            ) : files.length === 0 ? (
              <div className="flex min-h-[160px] items-center justify-center py-6">
                <p className="text-center text-sm text-muted">
                  No shared files yet. Share from Home or wait for invites.
                </p>
              </div>
            ) : viewMode === "grid" ? (
              <FileGrid
                files={files}
                sizeScale="xs"
                onFileOpen={(file) => {
                  void openFile(file);
                }}
              />
            ) : viewMode === "calendar" ? (
              <div className="grid gap-4">
                {filesByDay.map(([day, dayFiles]) => (
                  <section key={day} className="min-w-0">
                    <h3 className="mb-2 text-sm font-bold text-foreground">
                      {day}
                    </h3>
                    <FileGrid
                      files={dayFiles}
                      sizeScale="xs"
                      onFileOpen={(file) => {
                        void openFile(file);
                      }}
                    />
                  </section>
                ))}
              </div>
            ) : (
              <FileTable files={files} mode="shared" />
            )}
          </SuggestedSection>
        </>
      )}
    </div>
  );
}
