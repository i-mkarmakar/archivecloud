/* eslint-disable @typescript-eslint/no-misused-promises */
"use client";

import { Button } from "@heroui/react";
import {
  Clock,
  Database,
  Envelope,
  Folder,
  HardDrive,
  Tag,
  Xmark,
} from "@gravity-ui/icons";
import { useEffect, useMemo, useState } from "react";
import { SectionSkeleton } from "@/components/drive/PageSkeletons";
import type { FileItem } from "@/data/drive-data";
import { apiFetch, formatBytes, formatDate } from "@/lib/api";

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Tag;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-background-secondary p-3">
      <Icon className="mt-0.5 h-4 w-4 text-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">
          {label}
        </p>
        <p className="mt-1 break-words text-sm font-semibold text-foreground">
          {value}
        </p>
      </div>
    </div>
  );
}

export function FileDetailsDrawer({
  open,
  file,
  onClose,
}: {
  open: boolean;
  file: FileItem | null;
  onClose: () => void;
}) {
  type TagDef = { id: string; name: string; color: string };
  const [allTags, setAllTags] = useState<TagDef[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(
    new Set(),
  );
  const [loadingTags, setLoadingTags] = useState(false);
  const [savingTags, setSavingTags] = useState(false);

  const [newTagName, setNewTagName] = useState("");

  const fileId = file?.id ?? "";

  async function loadAllTags() {
    const data = await apiFetch<{ tags: TagDef[] }>("/tags");
    setAllTags(data.tags);
  }

  async function loadFileTags(activeFileId: string) {
    const data = await apiFetch<{ tags: TagDef[] }>(`/files/${activeFileId}/tags`);
    setSelectedTagIds(new Set(data.tags.map((t) => t.id)));
  }

  useEffect(() => {
    if (!open || !fileId) return;
    setLoadingTags(true);
    void (async () => {
      try {
        await Promise.all([loadAllTags(), loadFileTags(fileId)]);
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
    if (!fileId) return;
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
        className={
          open
            ? "fixed right-0 top-0 z-50 h-full w-full max-w-md translate-x-0 border-l border-border bg-surface shadow-overlay transition-transform duration-300"
            : "fixed right-0 top-0 z-50 h-full w-full max-w-md translate-x-full border-l border-border bg-surface shadow-overlay transition-transform duration-300"
        }
      >
        <div className="flex items-center justify-between border-b border-border p-5">
          <div>
            <h2 className="text-xl font-extrabold">File Details</h2>
            <p className="mt-1 max-w-[18rem] truncate text-sm text-muted">
              {file?.name ?? "No file selected"}
            </p>
          </div>
          <Button
            variant="outline"
            isIconOnly
            size="sm"
            onClick={onClose}
            aria-label="Close file details"
          >
            <Xmark className="h-5 w-5" />
          </Button>
        </div>
        {file ? (
          <div className="grid gap-3 p-5">
            <DetailRow icon={Tag} label="Name" value={file.name} />
            <DetailRow
              icon={Database}
              label="Size"
              value={file.sizeBytes ? formatBytes(file.sizeBytes) : file.size}
            />
            <DetailRow
              icon={Clock}
              label="Uploaded At"
              value={file.createdAt ? formatDate(file.createdAt) : file.date}
            />
            <DetailRow
              icon={Envelope}
              label="Google Account"
              value={file.accountEmail ?? file.access}
            />
            <DetailRow
              icon={HardDrive}
              label="Provider"
              value={file.accountProvider ?? "google_drive"}
            />
            <DetailRow
              icon={Folder}
              label="Virtual Folder"
              value={file.folderName ?? "No folder"}
            />
            <DetailRow
              icon={Tag}
              label="MIME Type"
              value={file.mimeType ?? "Unknown"}
            />

            <div className="rounded-xl border border-border bg-background-secondary p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">
                Tags
              </p>

              {loadingTags ? (
                <SectionSkeleton
                  className="mt-2"
                  rows={3}
                  label="Loading tags"
                />
              ) : (
                <>
                  {allTags.length > 0 ? (
                    <div className="mt-3 grid gap-2">
                      {allTags.map((t) => (
                        <label
                          key={t.id}
                          className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 hover:bg-surface-secondary"
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
                    <p className="mt-3 text-sm text-muted">
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
                        className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent"
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
      </aside>
    </>
  );
}
