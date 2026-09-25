"use client";

import { Folder, Magnifier } from "@gravity-ui/icons";
import { Button, toast } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { DummyModal } from "@/components/drive/DummyModal";
import { ActionTooltip } from "@/components/drive/ActionTooltip";
import { ProviderBrandIcon } from "@/components/ProviderBrandIcon";
import type { FolderItem } from "@/data/drive-data";
import { apiFetch } from "@/lib/api";
import { providerLabel } from "@/lib/providers";
import { cn } from "@/lib/utils";

export type MoveConnectedAccount = {
  id: string;
  provider: string;
  email: string;
  displayName?: string | null;
  status: string;
};

export type MoveSource =
  | { kind: "archive-files"; fileIds: string[] }
  | { kind: "archive-folder"; folderId: string }
  | {
      kind: "linked";
      accountId: string;
      providerId: string;
    };

type BrowseFolder = {
  id: string;
  name: string;
  badge: string;
  provider?: string;
  accountId?: string;
  /** Archive Cloud DB folder id, or linked provider folder id */
  targetId: string;
  linked?: boolean;
};

type Props = {
  open: boolean;
  itemName: string;
  source: MoveSource | null;
  accounts: MoveConnectedAccount[];
  archiveFolders: FolderItem[];
  excludeArchiveFolderIds?: Set<string>;
  onClose: () => void;
  onMoved: () => void | Promise<void>;
};

function accountTitle(account: MoveConnectedAccount) {
  return account.displayName?.trim() || `My ${providerLabel(account.provider)}`;
}

export function MoveDestinationModal({
  open,
  itemName,
  source,
  accounts,
  archiveFolders,
  excludeArchiveFolderIds,
  onClose,
  onMoved,
}: Props) {
  const connected = useMemo(
    () => accounts.filter((account) => account.status === "connected"),
    [accounts],
  );

  const [accountFilter, setAccountFilter] = useState<string | "all">("all");
  const [parentId, setParentId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<
    Array<{ id: string | null; name: string }>
  >([{ id: null, name: "All Files" }]);
  const [search, setSearch] = useState("");
  const [linkedFolders, setLinkedFolders] = useState<BrowseFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [moving, setMoving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sourceAccountId = source?.kind === "linked" ? source.accountId : null;
  const sourceProviderId = source?.kind === "linked" ? source.providerId : null;

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setSelectedId(null);
    setMoving(false);
    // Match All Cloud Hub: start at All Files with every cloud available.
    setAccountFilter("all");
    setParentId(null);
    setBreadcrumbs([{ id: null, name: "All Files" }]);
    setLinkedFolders([]);
  }, [open, source]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadBrowse() {
      setLoading(true);
      try {
        if (accountFilter === "all") {
          // Nested Archive Cloud folder: children come from archiveFolders memo.
          if (parentId !== null) {
            setLinkedFolders([]);
            setLoading(false);
            return;
          }

          // Root of All Files: Archive Cloud folders + each cloud's root folders.
          const archiveRows: BrowseFolder[] = archiveFolders
            .filter((folder) => {
              if (!folder.id) return false;
              if (excludeArchiveFolderIds?.has(folder.id)) return false;
              return (folder.parentId ?? null) === null;
            })
            .map((folder) => ({
              id: folder.id!,
              targetId: folder.id!,
              name: folder.name,
              badge: "ARCHIVE CLOUD",
              linked: false,
            }));

          const cloudResults = await Promise.all(
            connected.map(async (account) => {
              try {
                const browse = await apiFetch<{
                  folders: Array<{ id: string; name: string }>;
                }>(
                  `/connected-accounts/${account.id}/browse?parentId=root&limit=80`,
                );
                return (browse.folders ?? [])
                  .filter((folder) => {
                    if (
                      sourceAccountId === account.id &&
                      sourceProviderId &&
                      folder.id === sourceProviderId
                    ) {
                      return false;
                    }
                    return true;
                  })
                  .map((folder) => ({
                    id: `linked:${account.id}:${folder.id}`,
                    targetId: folder.id,
                    name: folder.name,
                    badge: accountTitle(account).toUpperCase(),
                    provider: account.provider,
                    accountId: account.id,
                    linked: true as const,
                  }));
              } catch {
                return [] as BrowseFolder[];
              }
            }),
          );

          if (cancelled) return;
          setLinkedFolders([...archiveRows, ...cloudResults.flat()]);
          return;
        }

        const browseParent =
          parentId && parentId !== "null" ? parentId : "root";
        const data = await apiFetch<{
          folders: Array<{ id: string; name: string }>;
          breadcrumbs?: Array<{ id: string; name: string }>;
        }>(
          `/connected-accounts/${accountFilter}/browse?parentId=${encodeURIComponent(browseParent)}&limit=80`,
        );
        if (cancelled) return;
        const account = connected.find((item) => item.id === accountFilter);
        const badge = account ? accountTitle(account).toUpperCase() : "CLOUD";
        setLinkedFolders(
          (data.folders ?? [])
            .filter((folder) => {
              if (
                sourceAccountId === accountFilter &&
                sourceProviderId &&
                folder.id === sourceProviderId
              ) {
                return false;
              }
              return true;
            })
            .map((folder) => ({
              id: `linked:${accountFilter}:${folder.id}`,
              targetId: folder.id,
              name: folder.name,
              badge,
              provider: account?.provider,
              accountId: accountFilter,
              linked: true,
            })),
        );
        if (data.breadcrumbs?.length) {
          const accountName = account ? accountTitle(account) : "Cloud";
          setBreadcrumbs([
            { id: "root", name: accountName },
            ...data.breadcrumbs
              .filter(
                (crumb) => crumb.id && crumb.id !== "root" && crumb.id !== "0",
              )
              .map((crumb) => ({ id: crumb.id, name: crumb.name })),
          ]);
        }
      } catch (error) {
        if (!cancelled) {
          setLinkedFolders([]);
          toast.danger(
            error instanceof Error ? error.message : "Failed to load folders",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadBrowse();
    return () => {
      cancelled = true;
    };
  }, [
    open,
    accountFilter,
    parentId,
    connected,
    archiveFolders,
    excludeArchiveFolderIds,
    sourceAccountId,
    sourceProviderId,
  ]);

  const archiveChildren = useMemo(() => {
    if (accountFilter !== "all") return [];
    // Nested Archive Cloud browsing when user opened an AC folder from All Files.
    if (parentId === null) return [];
    return archiveFolders
      .filter((folder) => {
        if (!folder.id) return false;
        if (excludeArchiveFolderIds?.has(folder.id)) return false;
        return (folder.parentId ?? null) === parentId;
      })
      .map((folder) => ({
        id: folder.id!,
        targetId: folder.id!,
        name: folder.name,
        badge: "ARCHIVE CLOUD",
        linked: false as const,
      }));
  }, [accountFilter, archiveFolders, excludeArchiveFolderIds, parentId]);

  const visibleFolders = useMemo(() => {
    const list =
      accountFilter === "all" && parentId === null
        ? linkedFolders
        : accountFilter === "all"
          ? archiveChildren
          : linkedFolders;
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((folder) => folder.name.toLowerCase().includes(q));
  }, [accountFilter, parentId, linkedFolders, archiveChildren, search]);

  const locationLabel = breadcrumbs.map((crumb) => crumb.name).join(" / ");
  const canMoveHere = Boolean(source) && selectedId !== null;

  function selectAccount(next: string | "all") {
    setSelectedId(null);
    setSearch("");
    if (next === "all") {
      setAccountFilter("all");
      setParentId(null);
      setBreadcrumbs([{ id: null, name: "All Files" }]);
      setLinkedFolders([]);
      return;
    }
    setAccountFilter(next);
    setParentId("root");
    const account = connected.find((item) => item.id === next);
    setBreadcrumbs([
      { id: "root", name: account ? accountTitle(account) : "Cloud" },
    ]);
  }

  function openFolder(folder: BrowseFolder) {
    setSelectedId(folder.id);
    setSearch("");
    if (folder.linked && folder.accountId) {
      setAccountFilter(folder.accountId);
      setParentId(folder.targetId);
      const account = connected.find((item) => item.id === folder.accountId);
      setBreadcrumbs([
        {
          id: "root",
          name: account ? accountTitle(account) : "Cloud",
        },
        { id: folder.targetId, name: folder.name },
      ]);
      return;
    }
    setAccountFilter("all");
    setParentId(folder.targetId);
    setBreadcrumbs((prev) => {
      const next = [...prev];
      if (next[next.length - 1]?.id !== folder.targetId) {
        next.push({ id: folder.targetId, name: folder.name });
      }
      return next;
    });
  }

  function goToBreadcrumb(index: number) {
    const crumb = breadcrumbs[index];
    if (!crumb) return;
    setSelectedId(null);
    setSearch("");
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
    if (accountFilter === "all") {
      setParentId(crumb.id);
    } else {
      setParentId(crumb.id ?? "root");
    }
  }

  async function handleMoveHere() {
    if (!source || selectedId === null) return;
    const selected = visibleFolders.find((folder) => folder.id === selectedId);
    if (!selected) return;

    setMoving(true);
    try {
      if (source.kind === "archive-files") {
        if (selected.linked) {
          throw new Error(
            "To move files into another cloud, use Transfers. Pick an Archive Cloud folder here.",
          );
        }
        await apiFetch("/files/batch", {
          method: "PATCH",
          body: JSON.stringify({
            fileIds: source.fileIds,
            folderId: selected.targetId,
          }),
        });
      } else if (source.kind === "archive-folder") {
        if (selected.linked) {
          throw new Error(
            "To move folders into another cloud, use Transfers. Pick an Archive Cloud folder here.",
          );
        }
        await apiFetch(`/folders/${source.folderId}`, {
          method: "PATCH",
          body: JSON.stringify({ parentId: selected.targetId }),
        });
      } else {
        // Linked cloud item: only same-cloud moves (provider move).
        if (!selected.linked || selected.accountId !== source.accountId) {
          throw new Error(
            "Items can only be moved within the same cloud. Switch to that account tab, or use Transfers for cross-cloud.",
          );
        }
        if (selected.targetId === source.providerId) {
          throw new Error("Cannot move a folder into itself.");
        }
        await apiFetch(
          `/connected-accounts/${source.accountId}/items/${encodeURIComponent(source.providerId)}`,
          {
            method: "PATCH",
            body: JSON.stringify({ parentId: selected.targetId }),
          },
        );
      }
      toast.success("Moved successfully.");
      onClose();
      await onMoved();
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : "Move failed");
    } finally {
      setMoving(false);
    }
  }

  return (
    <DummyModal
      open={open}
      title={`Move '${itemName}'`}
      onClose={onClose}
      size="cover"
      scroll="outside"
      className="w-[min(100%,44rem)] sm:max-w-2xl"
    >
      <div className="flex h-[min(78dvh,40rem)] flex-col gap-3 sm:gap-4">
        <p className="shrink-0 text-xs font-semibold tracking-wide text-muted">
          LOCATION:{" "}
          <span className="font-bold text-foreground">{locationLabel}</span>
        </p>

        <div className="flex shrink-0 flex-wrap gap-2">
          <ActionTooltip label="Browse all Archive Cloud folders">
            <button
              type="button"
              onClick={() => selectAccount("all")}
              className={cn(
                "inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm font-semibold transition",
                accountFilter === "all"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-white text-foreground hover:bg-black/5",
              )}
            >
              All Files
            </button>
          </ActionTooltip>
          {connected.map((account) => {
            const active = accountFilter === account.id;
            return (
              <ActionTooltip
                key={account.id}
                label={`Browse ${accountTitle(account)}`}
              >
                <button
                  type="button"
                  onClick={() => selectAccount(account.id)}
                  className={cn(
                    "inline-flex h-9 max-w-[11rem] cursor-pointer items-center gap-2 rounded-full border px-3 text-sm font-semibold transition",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-white text-foreground hover:bg-black/5",
                  )}
                >
                  <ProviderBrandIcon
                    name={account.provider}
                    className="h-4 w-4 shrink-0"
                    fallback={
                      <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-primary/10 text-[9px] font-bold text-primary">
                        {providerLabel(account.provider).charAt(0)}
                      </span>
                    }
                  />
                  <span className="truncate">{accountTitle(account)}</span>
                </button>
              </ActionTooltip>
            );
          })}
        </div>

        {sourceAccountId ? (
          <p className="shrink-0 text-xs leading-relaxed text-muted">
            Linked items move within the same cloud only. Other clouds are shown
            to browse — use Transfers for cross-cloud.
          </p>
        ) : null}

        <div className="relative shrink-0">
          <Magnifier className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search folders..."
            className="h-11 w-full rounded-xl border border-border bg-white py-2 pr-3 pl-9 text-sm text-foreground outline-none placeholder:text-muted focus:border-foreground/30"
          />
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1 text-sm">
          {breadcrumbs.map((crumb, index) => (
            <span
              key={`${crumb.id ?? "root"}-${index}`}
              className="flex items-center gap-1"
            >
              {index > 0 ? <span className="text-muted">/</span> : null}
              {index === breadcrumbs.length - 1 ? (
                <span className="font-semibold text-foreground">
                  {crumb.name}
                </span>
              ) : (
                <ActionTooltip label={`Go to ${crumb.name}`}>
                  <button
                    type="button"
                    className="cursor-pointer font-semibold text-foreground hover:underline"
                    onClick={() => goToBreadcrumb(index)}
                  >
                    {crumb.name}
                  </button>
                </ActionTooltip>
              )}
            </span>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border bg-white">
          {loading ? (
            <p className="px-4 py-10 text-center text-sm text-muted">
              Loading folders…
            </p>
          ) : visibleFolders.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted">
              No folders here. Open a cloud tab or go back.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {visibleFolders.map((folder) => {
                const selected = selectedId === folder.id;
                const sameCloudOk =
                  !sourceAccountId ||
                  !folder.linked ||
                  folder.accountId === sourceAccountId;
                return (
                  <li key={folder.id}>
                    <div
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-3 transition sm:px-4",
                        selected ? "bg-primary/10" : "hover:bg-black/[0.03]",
                        !sameCloudOk && sourceAccountId ? "opacity-70" : null,
                      )}
                    >
                      <ActionTooltip label={`Select “${folder.name}”`}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(folder.id);
                          }}
                          onDoubleClick={() => openFolder(folder)}
                          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
                        >
                          <Folder className="h-5 w-5 shrink-0 text-primary" />
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                            {folder.name}
                          </span>
                          <span className="hidden shrink-0 rounded-full bg-surface-secondary px-2.5 py-1 text-[10px] font-bold tracking-wide text-muted sm:inline-flex">
                            {folder.badge}
                          </span>
                        </button>
                      </ActionTooltip>
                      <ActionTooltip label={`Open “${folder.name}”`}>
                        <button
                          type="button"
                          className="shrink-0 cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/10"
                          onClick={() => openFolder(folder)}
                        >
                          Open
                        </button>
                      </ActionTooltip>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between sm:pt-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-foreground">
              {locationLabel}
            </p>
            <p className="text-xs text-muted">
              {canMoveHere
                ? "Ready to move into the selected folder"
                : "Select a destination folder (Open to browse inside)"}
            </p>
          </div>
          <div className="flex shrink-0 justify-end gap-2">
            <ActionTooltip label="Cancel move">
              <Button type="button" variant="outline" onPress={onClose}>
                Cancel
              </Button>
            </ActionTooltip>
            <ActionTooltip
              label={
                canMoveHere
                  ? "Move into the selected folder"
                  : "Select a destination folder first"
              }
            >
              <Button
                type="button"
                isDisabled={!canMoveHere || moving}
                onPress={() => {
                  void handleMoveHere();
                }}
              >
                {moving ? "Moving…" : "Move Here"}
              </Button>
            </ActionTooltip>
          </div>
        </div>
      </div>
    </DummyModal>
  );
}
