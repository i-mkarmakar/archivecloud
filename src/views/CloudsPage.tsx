"use client";

import {
  ArrowRight,
  Cloud,
  Folder,
  FolderOpen,
} from "@gravity-ui/icons";
import { Button, Card, toast } from "@heroui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { GoogleDriveLogo } from "@/components/drive/GoogleDriveLogo";
import { PageHeader } from "@/components/drive/PageHeader";
import {
  AccountCardsSkeleton,
  FileListSkeleton,
} from "@/components/drive/PageSkeletons";
import { apiFetch, formatBytes, formatDate } from "@/lib/api";
import { isSupportedProviderId, providerLabel } from "@/lib/providers";
import { cn } from "@/lib/utils";

type ConnectedAccount = {
  id: string;
  email: string;
  displayName?: string | null;
  provider: string;
};

type BrowseFolder = { id: string; name: string; modifiedTime: string };
type BrowseFile = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: string;
  modifiedTime: string;
  dbFileId?: string | null;
};
type BrowseResult = {
  folders: BrowseFolder[];
  files: BrowseFile[];
  breadcrumbs: Array<{ id: string; name: string }>;
};

type VirtualFolder = {
  id: string;
  name: string;
};

export function CloudsPage() {
  const sp = useSearchParams() ?? new URLSearchParams();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [accountId, setAccountId] = useState<string>(sp.get("accountId") ?? "");
  const [parentId, setParentId] = useState(sp.get("parentId") ?? "root");
  const [browse, setBrowse] = useState<BrowseResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [error, setError] = useState("");
  const [copyFile, setCopyFile] = useState<BrowseFile | null>(null);
  const [destAccountId, setDestAccountId] = useState("");
  const [copying, setCopying] = useState(false);
  const [previewFile, setPreviewFile] = useState<BrowseFile | null>(null);
  const [virtualFile, setVirtualFile] = useState<BrowseFile | null>(null);
  const [virtualFolders, setVirtualFolders] = useState<VirtualFolder[]>([]);
  const [virtualFolderId, setVirtualFolderId] = useState("");
  const [addingToVirtual, setAddingToVirtual] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === accountId) ?? null,
    [accounts, accountId],
  );

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<{ accounts: ConnectedAccount[] }>(
        "/connected-accounts",
      );
      const supported = data.accounts.filter((a) =>
        isSupportedProviderId(a.provider),
      );
      setAccounts(supported);
      if (!accountId && supported[0]) {
        setAccountId(supported[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  const loadBrowse = useCallback(async () => {
    if (!accountId) {
      setBrowse(null);
      return;
    }
    setBrowseLoading(true);
    try {
      const params = new URLSearchParams({ parentId });
      const data = await apiFetch<BrowseResult>(
        `/connected-accounts/${accountId}/browse?${params}`,
      );
      setBrowse(data);
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : "Browse failed");
      setBrowse(null);
    } finally {
      setBrowseLoading(false);
    }
  }, [accountId, parentId]);

  useEffect(() => {
    loadAccounts().catch(() => undefined);
  }, [loadAccounts]);

  useEffect(() => {
    loadBrowse().catch(() => undefined);
  }, [loadBrowse]);

  async function startCopy() {
    if (!copyFile || !accountId || !destAccountId) return;
    setCopying(true);
    try {
      await apiFetch("/transfers", {
        method: "POST",
        body: JSON.stringify({
          sourceAccountId: accountId,
          destAccountId,
          sourceProviderFileId: copyFile.id,
          sourceFileId: copyFile.dbFileId ?? undefined,
          fileName: copyFile.name,
        }),
      });
      toast.success("Transfer queued. Check Run History");
      setCopyFile(null);
      setDestAccountId("");
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : "Copy failed");
    } finally {
      setCopying(false);
    }
  }

  async function renameItem(itemId: string, name: string) {
    if (!accountId) return;
    try {
      await apiFetch(`/connected-accounts/${accountId}/items/${encodeURIComponent(itemId)}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      toast.success("Renamed");
      await loadBrowse();
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : "Rename failed");
    }
  }

  async function createFolder() {
    if (!accountId) return;
    const name = window.prompt("New folder name");
    if (!name?.trim()) return;
    setCreatingFolder(true);
    try {
      await apiFetch(`/connected-accounts/${accountId}/folders`, {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          parentId: parentId === "root" ? undefined : parentId,
        }),
      });
      toast.success("Folder created");
      await loadBrowse();
    } catch (err) {
      toast.danger(
        err instanceof Error ? err.message : "Failed to create folder",
      );
    } finally {
      setCreatingFolder(false);
    }
  }

  async function openVirtualModal(file: BrowseFile) {
    setVirtualFile(file);
    try {
      const data = await apiFetch<{ folders: VirtualFolder[] }>(
        "/vf",
      );
      setVirtualFolders(data.folders);
      setVirtualFolderId(data.folders[0]?.id ?? "");
    } catch (err) {
      toast.danger(
        err instanceof Error ? err.message : "Failed to load virtual folders",
      );
      setVirtualFile(null);
    }
  }

  async function addToVirtualFolder() {
    if (!virtualFile || !accountId || !virtualFolderId) return;
    setAddingToVirtual(true);
    try {
      await apiFetch(`/vf/${virtualFolderId}/items`, {
        method: "POST",
        body: JSON.stringify({
          connectedAccountId: accountId,
          providerFileId: virtualFile.id,
          providerFolderId: parentId === "root" ? undefined : parentId,
          name: virtualFile.name,
          mimeType: virtualFile.mimeType,
          sizeBytes: virtualFile.sizeBytes,
          kind: "file",
        }),
      });
      toast.success("Added to virtual folder");
      setVirtualFile(null);
      setVirtualFolderId("");
    } catch (err) {
      toast.danger(
        err instanceof Error ? err.message : "Failed to add to virtual folder",
      );
    } finally {
      setAddingToVirtual(false);
    }
  }

  async function deleteItem(itemId: string) {
    if (!accountId) return;
    try {
      await apiFetch(`/connected-accounts/${accountId}/items/${encodeURIComponent(itemId)}`, {
        method: "DELETE",
      });
      toast.success("Deleted");
      await loadBrowse();
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : "Delete failed");
    }
  }

  function providerFileUrl(fileId: string, kind: "preview" | "download") {
    return `/connected-accounts/${accountId}/files/${encodeURIComponent(fileId)}/${kind}`;
  }

  function downloadFile(file: BrowseFile) {
    if (!accountId) return;
    const anchor = document.createElement("a");
    anchor.href = providerFileUrl(file.id, "download");
    anchor.download = file.name;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  const destOptions = accounts.filter((a) => a.id !== accountId);

  return (
    <>
      <PageHeader
        title="Clouds"
        description="Browse connected cloud accounts and copy files between them."
      />

      {loading ? (
        <AccountCardsSkeleton className="mt-6" label="Loading connected clouds" />
      ) : null}
      {error ? <p className="mt-6 text-sm text-danger">{error}</p> : null}

      {!loading && accounts.length === 0 ? (
        <Card className="mt-6 p-8 text-center">
          <Cloud className="mx-auto h-8 w-8 text-muted" />
          <p className="mt-4 font-extrabold">No clouds connected</p>
          <p className="mt-2 text-sm text-muted">
            Connect a cloud provider in Settings to browse and transfer.
          </p>
          <Button
            className="mt-4"
            onClick={() => {
              window.location.href = "/settings";
            }}
          >
            Open Settings
          </Button>
        </Card>
      ) : null}

      {accounts.length > 0 ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-[240px_1fr]">
          <Card className="h-fit p-3">
            <p className="px-2 pb-2 text-xs font-bold uppercase tracking-wide text-muted">
              Accounts
            </p>
            <div className="grid gap-1">
              {accounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                    account.id === accountId
                      ? "bg-accent/15 font-bold text-foreground"
                      : "hover:bg-surface-secondary",
                  )}
                  onClick={() => {
                    setAccountId(account.id);
                    setParentId("root");
                  }}
                >
                  <GoogleDriveLogo className="h-5 w-5 shrink-0" />
                  <span className="min-w-0 truncate">
                    {providerLabel(account.provider)} ·{" "}
                    {account.displayName || account.email}
                  </span>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
              {(browse?.breadcrumbs ?? [{ id: "root", name: "My Drive" }]).map(
                (crumb, index, all) => (
                  <button
                    key={`${crumb.id}-${index}`}
                    type="button"
                    className={cn(
                      "text-sm",
                      index === all.length - 1
                        ? "font-extrabold"
                        : "text-muted hover:text-foreground",
                    )}
                    onClick={() => setParentId(crumb.id)}
                  >
                    {index > 0 ? (
                      <span className="mr-2 text-muted">/</span>
                    ) : null}
                    {crumb.name}
                  </button>
                ),
              )}
              <div className="ml-auto flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  isDisabled={creatingFolder}
                  onClick={() => createFolder()}
                >
                  {creatingFolder ? "Creating…" : "New folder"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => loadBrowse().catch(() => undefined)}
                >
                  Refresh
                </Button>
              </div>
            </div>

            {browseLoading ? (
              <FileListSkeleton className="mt-6" count={8} label="Loading folder" />
            ) : null}

            {!browseLoading && browse ? (
              <div className="mt-4 grid gap-1">
                {browse.folders.map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-surface-secondary"
                    onClick={() => setParentId(folder.id)}
                  >
                    <FolderOpen className="h-5 w-5 text-accent" />
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      {folder.name}
                    </span>
                    <Folder className="h-4 w-4 text-muted" />
                  </button>
                ))}
                {browse.files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-secondary"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{file.name}</p>
                      <p className="text-xs text-muted">
                        {formatBytes(file.sizeBytes)} ·{" "}
                        {formatDate(file.modifiedTime)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPreviewFile(file)}
                      >
                        Preview
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadFile(file)}
                      >
                        Download
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openVirtualModal(file)}
                      >
                        Add to virtual…
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        isDisabled={accounts.length < 2}
                        onClick={() => {
                          setCopyFile(file);
                          setDestAccountId(
                            destOptions[0]?.id ??
                              accounts.find((a) => a.id !== accountId)?.id ??
                              "",
                          );
                        }}
                      >
                        <ArrowRight className="h-4 w-4" />
                        Copy to…
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const next = window.prompt("Rename file", file.name);
                          if (!next || next.trim() === file.name) return;
                          renameItem(file.id, next).catch(() => undefined);
                        }}
                      >
                        Rename
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (
                            !window.confirm(
                              `Delete “${file.name}” from this cloud?`,
                            )
                          ) {
                            return;
                          }
                          deleteItem(file.id).catch(() => undefined);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
                {browse.folders.length === 0 && browse.files.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted">
                    This folder is empty.
                  </p>
                ) : null}
              </div>
            ) : null}

            {selectedAccount && accounts.length < 2 ? (
              <p className="mt-4 text-sm text-muted">
                Connect a second cloud account to enable cloud-to-cloud copy.
              </p>
            ) : null}
          </Card>
        </div>
      ) : null}

      {virtualFile ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-backdrop/40 p-4">
          <Card className="w-full max-w-md p-5">
            <p className="text-lg font-extrabold">Add to virtual folder</p>
            <p className="mt-1 truncate text-sm text-muted">{virtualFile.name}</p>
            {virtualFolders.length === 0 ? (
              <p className="mt-4 text-sm text-muted">
                No virtual folders yet. Create one from the Virtual Folders
                page.
              </p>
            ) : (
              <div className="mt-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                  Virtual folder
                </p>
                <select
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
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
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setVirtualFile(null);
                  setVirtualFolderId("");
                }}
              >
                Cancel
              </Button>
              <Button
                isDisabled={
                  !virtualFolderId || addingToVirtual || virtualFolders.length === 0
                }
                onClick={() => addToVirtualFolder()}
              >
                {addingToVirtual ? "Adding…" : "Add reference"}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {copyFile ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-backdrop/40 p-4">
          <Card className="w-full max-w-md p-5">
            <p className="text-lg font-extrabold">Copy to another cloud</p>
            <p className="mt-1 truncate text-sm text-muted">{copyFile.name}</p>
            <div className="mt-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                Destination account
              </p>
              <select
                className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
                value={destAccountId}
                onChange={(event) => setDestAccountId(event.target.value)}
              >
                {destOptions.map((account) => (
                  <option key={account.id} value={account.id}>
                    {providerLabel(account.provider)} ·{" "}
                    {account.displayName || account.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCopyFile(null);
                  setDestAccountId("");
                }}
              >
                Cancel
              </Button>
              <Button
                isDisabled={!destAccountId || copying}
                onClick={() => startCopy()}
              >
                {copying ? "Queuing…" : "Start copy"}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {previewFile && accountId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-backdrop/40 p-4">
          <Card className="flex max-h-[90vh] w-full max-w-3xl flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-lg font-extrabold">
                  {previewFile.name}
                </p>
                <p className="text-xs text-muted">{previewFile.mimeType}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPreviewFile(null)}
              >
                Close
              </Button>
            </div>
            <div className="mt-4 min-h-0 flex-1 overflow-auto rounded-xl border border-border bg-surface-secondary">
              {previewFile.mimeType.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={providerFileUrl(previewFile.id, "preview")}
                  alt={previewFile.name}
                  className="mx-auto max-h-[70vh] w-auto object-contain"
                />
              ) : previewFile.mimeType === "application/pdf" ||
                previewFile.mimeType.startsWith("text/") ||
                previewFile.mimeType.startsWith("video/") ||
                previewFile.mimeType.startsWith("audio/") ? (
                <iframe
                  title={previewFile.name}
                  src={providerFileUrl(previewFile.id, "preview")}
                  className="h-[70vh] w-full border-0"
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
                  <p className="text-sm text-muted">
                    Inline preview isn’t available for this file type.
                  </p>
                  <Button onClick={() => downloadFile(previewFile)}>
                    Download instead
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>
      ) : null}
    </>
  );
}
