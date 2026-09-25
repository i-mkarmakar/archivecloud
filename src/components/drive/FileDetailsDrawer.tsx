"use client";

import { Button } from "@heroui/react";
import { Archive, FileText, Picture, Play, Xmark } from "@gravity-ui/icons";
import { useEffect, useMemo, useState } from "react";
import { SectionSkeleton } from "@/components/drive/PageSkeletons";
import { ProviderBrandIcon } from "@/components/ProviderBrandIcon";
import type { FileItem } from "@/data/drive-data";
import { apiFetch, formatBytes, formatDate } from "@/lib/api";
import { cn } from "@/lib/utils";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="shrink-0 text-sm font-medium text-[#7b879c]">
        {label}
      </span>
      <span className="min-w-0 break-words text-right text-sm font-semibold text-foreground">
        {value}
      </span>
    </div>
  );
}

function fileExtension(name: string) {
  const match = /\.([a-z0-9]+)$/i.exec(name.trim());
  return match?.[1]?.toLowerCase() ?? "";
}

function isZipFile(file: FileItem) {
  const mime = (file.mimeType ?? "").toLowerCase();
  const ext = fileExtension(file.name);
  return (
    mime.includes("zip") ||
    mime.includes("x-zip") ||
    mime.includes("compressed") ||
    ["zip", "rar", "7z", "tar", "gz"].includes(ext)
  );
}

function fileTypeMeta(file: FileItem): {
  badge: string;
  typeLabel: string;
  mimeLabel: string;
  previewKind: "image" | "video" | "pdf" | "zip" | "doc";
} {
  const mime = file.mimeType ?? "application/octet-stream";
  const ext = fileExtension(file.name);

  if (file.kind === "image" || mime.startsWith("image/")) {
    return {
      badge: "Image",
      typeLabel: "Image",
      mimeLabel: `${mime} (Image)`,
      previewKind: "image",
    };
  }
  if (file.kind === "video" || mime.startsWith("video/")) {
    return {
      badge: "Video",
      typeLabel: "Video",
      mimeLabel: `${mime} (Video)`,
      previewKind: "video",
    };
  }
  if (file.kind === "pdf" || mime.includes("pdf") || ext === "pdf") {
    return {
      badge: "PDF",
      typeLabel: "PDF Document",
      mimeLabel: `${mime} (PDF)`,
      previewKind: "pdf",
    };
  }
  if (isZipFile(file)) {
    return {
      badge: "ZIP File",
      typeLabel: "ZIP File",
      mimeLabel: `${mime.includes("octet-stream") && ext === "zip" ? "application/zip" : mime} (Archive)`,
      previewKind: "zip",
    };
  }
  return {
    badge: ext ? `${ext.toUpperCase()} File` : "File",
    typeLabel: ext ? `${ext.toUpperCase()} File` : "Document",
    mimeLabel: mime,
    previewKind: "doc",
  };
}

function FileTypePreview({
  file,
  previewKind,
  typeLabel,
  onOpen,
}: {
  file: FileItem;
  previewKind: ReturnType<typeof fileTypeMeta>["previewKind"];
  typeLabel: string;
  onOpen?: () => void;
}) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const showThumb =
    (previewKind === "image" || previewKind === "video") &&
    Boolean(file.thumbnailUrl) &&
    !thumbFailed;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full cursor-pointer flex-col items-center justify-center px-4 py-4 transition-opacity hover:opacity-95"
    >
      {showThumb ? (
        <div className="flex h-36 w-full items-center justify-center overflow-hidden rounded-xl">
          <img
            src={file.thumbnailUrl ?? undefined}
            alt=""
            className="max-h-36 max-w-full rounded-lg object-contain"
            onError={() => setThumbFailed(true)}
          />
        </div>
      ) : previewKind === "zip" ? (
        <div className="flex flex-col items-center gap-2">
          <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#7c3aed] text-2xl font-extrabold tracking-wide text-white shadow-sm">
            ZIP
          </span>
          <span className="text-sm font-medium text-[#7b879c]">
            {typeLabel}
          </span>
        </div>
      ) : previewKind === "pdf" ? (
        <div className="flex flex-col items-center gap-2">
          <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#ef4444] text-white shadow-sm">
            <Archive className="h-9 w-9" />
          </span>
          <span className="text-sm font-medium text-[#7b879c]">
            {typeLabel}
          </span>
        </div>
      ) : previewKind === "video" ? (
        <div className="flex flex-col items-center gap-2">
          <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-white shadow-sm">
            <Play className="h-9 w-9" />
          </span>
          <span className="text-sm font-medium text-[#7b879c]">
            {typeLabel}
          </span>
        </div>
      ) : previewKind === "image" ? (
        <div className="flex flex-col items-center gap-2">
          <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#22c55e] text-white shadow-sm">
            <Picture className="h-9 w-9" />
          </span>
          <span className="text-sm font-medium text-[#7b879c]">
            {typeLabel}
          </span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#64748b] text-white shadow-sm">
            <FileText className="h-9 w-9" />
          </span>
          <span className="text-sm font-medium text-[#7b879c]">
            {typeLabel}
          </span>
        </div>
      )}
    </button>
  );
}

export function FileDetailsDrawer({
  open,
  file,
  onClose,
  onOpenFile,
}: {
  open: boolean;
  file: FileItem | null;
  onClose: () => void;
  onOpenFile?: () => void;
}) {
  type TagDef = { id: string; name: string; color: string };
  const [allTags, setAllTags] = useState<TagDef[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [loadingTags, setLoadingTags] = useState(false);
  const [savingTags, setSavingTags] = useState(false);
  const [newTagName, setNewTagName] = useState("");

  const fileId = file?.id ?? "";
  const meta = file ? fileTypeMeta(file) : null;
  const extension = file ? fileExtension(file.name) : "";
  const providerName = file?.accountProvider?.trim() || "Archive Cloud";
  const accountName =
    file?.accountDisplayName?.trim() ||
    file?.accountEmail?.trim() ||
    providerName;
  const modified =
    file?.updatedAt || file?.createdAt
      ? formatDate(file.updatedAt ?? file.createdAt ?? "")
      : file?.date || "—";
  const sizeLabel = file?.sizeBytes
    ? formatBytes(file.sizeBytes)
    : file?.size || "—";

  async function loadAllTags() {
    const data = await apiFetch<{ tags: TagDef[] }>("/tags");
    setAllTags(data.tags);
  }

  async function loadFileTags(activeFileId: string) {
    const data = await apiFetch<{ tags: TagDef[] }>(
      `/files/${activeFileId}/tags`,
    );
    setSelectedTagIds(new Set(data.tags.map((t) => t.id)));
  }

  useEffect(() => {
    if (!open || !fileId) return;
    // Linked provider files use synthetic ids — skip tag APIs.
    if (fileId.startsWith("linked:")) {
      setAllTags([]);
      setSelectedTagIds(new Set());
      return;
    }
    setLoadingTags(true);
    void (async () => {
      try {
        await Promise.all([loadAllTags(), loadFileTags(fileId)]);
      } catch {
        setAllTags([]);
        setSelectedTagIds(new Set());
      } finally {
        setLoadingTags(false);
      }
    })();
  }, [open, fileId]);

  const selectedTags = useMemo(() => {
    if (selectedTagIds.size === 0) return [];
    return allTags.filter((t) => selectedTagIds.has(t.id));
  }, [allTags, selectedTagIds]);

  async function saveTags() {
    if (!fileId || fileId.startsWith("linked:")) return;
    setSavingTags(true);
    try {
      await apiFetch(`/files/${fileId}/tags`, {
        method: "PUT",
        body: JSON.stringify({ tagIds: Array.from(selectedTagIds) }),
      });
    } finally {
      setSavingTags(false);
    }
  }

  async function createTag() {
    const name = newTagName.trim();
    if (!name) return;
    try {
      const created = await apiFetch<{ tag: TagDef }>("/tags", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setNewTagName("");
      setSelectedTagIds((prev) => new Set([...prev, created.tag.id]));
      await loadAllTags();
    } catch (err) {
      console.error(err);
    }
  }

  const canManageTags = Boolean(fileId) && !fileId.startsWith("linked:");

  return (
    <>
      <button
        type="button"
        className={
          open
            ? "fixed inset-0 z-40 bg-backdrop/30"
            : "pointer-events-none fixed inset-0 z-40 bg-backdrop/0"
        }
        aria-label="Close file details"
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-white shadow-overlay transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
          <h2 className="min-w-0 flex-1 truncate text-2xl font-extrabold tracking-tight text-foreground">
            {file?.name ?? "File"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close file details"
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-black/5 hover:text-foreground"
          >
            <Xmark className="h-5 w-5" />
          </button>
        </div>

        {file && meta ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
            <FileTypePreview
              file={file}
              previewKind={meta.previewKind}
              typeLabel={meta.typeLabel}
              onOpen={onOpenFile}
            />

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">
                {meta.badge}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef1f6] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#4a5568]">
                <ProviderBrandIcon
                  name={file.accountProvider || "google_drive"}
                  className="h-3.5 w-3.5 shrink-0"
                  fallback={
                    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-primary/15 text-[8px] font-bold text-primary">
                      {providerName.charAt(0)}
                    </span>
                  }
                />
                {providerName}
              </span>
            </div>

            <div className="mt-6">
              <h3 className="text-base font-extrabold text-foreground">
                Information
              </h3>
              <div className="mt-2 divide-y divide-border/70">
                <InfoRow label="Type" value={meta.typeLabel} />
                <InfoRow label="Size" value={sizeLabel} />
                <InfoRow label="Modified" value={modified} />
                <InfoRow label="Owner" value="You" />
                <InfoRow label="Account" value={accountName} />
                <InfoRow label="MIME TYPE" value={meta.mimeLabel} />
                {extension ? (
                  <InfoRow label="Extension" value={extension} />
                ) : null}
              </div>
            </div>

            {canManageTags ? (
              <div className="mt-6">
                <h3 className="text-base font-extrabold text-foreground">
                  Tags
                </h3>
                <div className="mt-3 rounded-xl border border-border bg-[#f8fafc] p-3">
                  {loadingTags ? (
                    <SectionSkeleton
                      className="mt-1"
                      rows={3}
                      label="Loading tags"
                    />
                  ) : (
                    <>
                      {allTags.length > 0 ? (
                        <div className="grid gap-2">
                          {allTags.map((t) => (
                            <label
                              key={t.id}
                              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 hover:bg-white"
                            >
                              <input
                                type="checkbox"
                                checked={selectedTagIds.has(t.id)}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setSelectedTagIds((prev) => {
                                    const next = new Set(prev);
                                    if (checked) next.add(t.id);
                                    else next.delete(t.id);
                                    return next;
                                  });
                                }}
                              />
                              <span
                                className={`h-2.5 w-2.5 rounded-full ${t.color}`}
                              />
                              <span className="text-sm font-semibold text-foreground">
                                {t.name}
                              </span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted">
                          No tags yet. Create one below.
                        </p>
                      )}

                      <div className="mt-3 grid gap-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newTagName}
                            placeholder="New tag name"
                            onChange={(e) => setNewTagName(e.target.value)}
                            className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-accent"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => createTag().catch(() => undefined)}
                          >
                            Add
                          </Button>
                        </div>
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            isDisabled={savingTags}
                            onClick={() => saveTags().catch(() => undefined)}
                          >
                            {savingTags ? "Saving…" : "Save tags"}
                          </Button>
                        </div>
                        {selectedTags.length > 0 ? (
                          <p className="text-xs text-muted">
                            Selected:{" "}
                            {selectedTags
                              .map((t) => t.name)
                              .slice(0, 4)
                              .join(", ")}
                            {selectedTags.length > 4 ? "…" : ""}
                          </p>
                        ) : (
                          <p className="text-xs text-muted">
                            No tags selected.
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </aside>
    </>
  );
}
