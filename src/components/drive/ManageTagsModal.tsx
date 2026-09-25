"use client";

import { CircleInfo, FileText, Folder, Xmark } from "@gravity-ui/icons";
import { Button, toast } from "@heroui/react";
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { DummyModal } from "@/components/drive/DummyModal";
import { ActionTooltip } from "@/components/drive/ActionTooltip";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type TagDef = {
  id: string;
  name: string;
  color: string;
};

const MAX_TAGS = 20;

export type ManageTagsTarget = {
  kind: "file" | "folder";
  id: string;
  name: string;
};

type Props = {
  open: boolean;
  target: ManageTagsTarget | null;
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
};

function isLinkedFile(target: ManageTagsTarget) {
  return target.kind === "file" && target.id.startsWith("linked:");
}

export function ManageTagsModal({ open, target, onClose, onSaved }: Props) {
  const [allTags, setAllTags] = useState<TagDef[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const unsupported = Boolean(target && isLinkedFile(target));
  const tagsPath =
    target && !unsupported
      ? target.kind === "folder"
        ? `/folders/${encodeURIComponent(target.id)}/tags`
        : `/files/${encodeURIComponent(target.id)}/tags`
      : null;

  useEffect(() => {
    if (!open || !target || !tagsPath) {
      setAllTags([]);
      setSelectedIds(new Set());
      setInputValue("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [allRes, itemRes] = await Promise.all([
          apiFetch<{ tags: TagDef[] }>("/tags"),
          apiFetch<{ tags: TagDef[] }>(tagsPath),
        ]);
        if (cancelled) return;
        setAllTags(allRes.tags);
        setSelectedIds(new Set(itemRes.tags.map((tag) => tag.id)));
      } catch (error) {
        if (!cancelled) {
          toast.danger(
            error instanceof Error ? error.message : "Failed to load tags",
          );
          setAllTags([]);
          setSelectedIds(new Set());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, target, tagsPath]);

  const selectedTags = useMemo(
    () => allTags.filter((tag) => selectedIds.has(tag.id)),
    [allTags, selectedIds],
  );

  const suggestions = useMemo(() => {
    const q = inputValue.trim().toLowerCase();
    return allTags
      .filter((tag) => !selectedIds.has(tag.id))
      .filter((tag) => (q ? tag.name.toLowerCase().includes(q) : true))
      .slice(0, 8);
  }, [allTags, selectedIds, inputValue]);

  function toggleTag(tagId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
        return next;
      }
      if (next.size >= MAX_TAGS) {
        toast.danger(`You can add up to ${MAX_TAGS} tags.`);
        return prev;
      }
      next.add(tagId);
      return next;
    });
  }

  async function createAndSelectTag(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (selectedIds.size >= MAX_TAGS) {
      toast.danger(`You can add up to ${MAX_TAGS} tags.`);
      return;
    }

    const existing = allTags.find(
      (tag) => tag.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) {
      setSelectedIds((prev) => new Set([...prev, existing.id]));
      setInputValue("");
      return;
    }

    try {
      const created = await apiFetch<{ tag: TagDef }>("/tags", {
        method: "POST",
        body: JSON.stringify({ name: trimmed }),
      });
      setAllTags((prev) =>
        [...prev, created.tag].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setSelectedIds((prev) => new Set([...prev, created.tag.id]));
      setInputValue("");
    } catch (error) {
      toast.danger(
        error instanceof Error ? error.message : "Failed to create tag",
      );
    }
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void createAndSelectTag(inputValue);
  }

  async function handleSave(event?: FormEvent) {
    event?.preventDefault();
    if (!target || !tagsPath) return;
    setSaving(true);
    try {
      await apiFetch(tagsPath, {
        method: "PUT",
        body: JSON.stringify({ tagIds: Array.from(selectedIds) }),
      });
      toast.success("Tags saved.");
      onClose();
      await onSaved?.();
    } catch (error) {
      toast.danger(
        error instanceof Error ? error.message : "Failed to save tags",
      );
    } finally {
      setSaving(false);
    }
  }

  const kindLabel = target?.kind === "folder" ? "Folder" : "File";
  const KindIcon = target?.kind === "folder" ? Folder : FileText;

  return (
    <DummyModal open={open} title="Manage Tags" onClose={onClose} size="md">
      {unsupported || !target ? (
        <div className="grid gap-4">
          <p className="text-sm text-muted">
            Tags are only available for files stored in Archive Cloud.
          </p>
          <div className="flex justify-end">
            <Button variant="outline" onPress={onClose}>
              Close
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSave} className="grid gap-5">
          <div className="flex min-w-0 items-center gap-2">
            <KindIcon className="h-5 w-5 shrink-0 text-primary" />
            <p className="min-w-0 truncate text-sm font-extrabold text-foreground">
              {kindLabel} : {target.name || "Untitled"}
            </p>
          </div>

          <p className="flex items-start gap-2 text-sm italic text-muted">
            <ActionTooltip label="Tags help you find items later">
              <span className="mt-0.5 inline-flex shrink-0">
                <CircleInfo className="h-4 w-4" />
              </span>
            </ActionTooltip>
            <span>
              Tags help you organize and quickly find this{" "}
              {kindLabel.toLowerCase()} later.
            </span>
          </p>

          <div className="grid gap-2">
            <div>
              <p className="text-sm font-extrabold text-foreground">Tags</p>
              <p className="mt-0.5 text-xs text-muted">
                Select an existing tag, or type a new one and press Enter to
                create it
              </p>
            </div>

            {selectedTags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {selectedTags.map((tag) => (
                  <ActionTooltip key={tag.id} label={`Remove “${tag.name}”`}>
                    <button
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-surface-secondary px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-black/5"
                    >
                      {tag.name}
                      <Xmark className="h-3.5 w-3.5 text-muted" />
                    </button>
                  </ActionTooltip>
                ))}
              </div>
            ) : null}

            <input
              type="text"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="e.g. work, urgent, review"
              disabled={loading || saving}
              className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-foreground/30"
            />
            <p className="text-xs text-muted">
              {selectedIds.size}/{MAX_TAGS} tags
            </p>

            {loading ? (
              <p className="text-xs text-muted">Loading tags…</p>
            ) : suggestions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((tag) => (
                  <ActionTooltip key={tag.id} label={`Add “${tag.name}”`}>
                    <button
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={cn(
                        "cursor-pointer rounded-full border border-border px-2.5 py-1 text-xs font-semibold transition",
                        "bg-white text-foreground hover:border-primary/40 hover:bg-primary/5",
                      )}
                    >
                      {tag.name}
                    </button>
                  </ActionTooltip>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex justify-end gap-3">
            <ActionTooltip label="Discard changes">
              <Button
                type="button"
                variant="outline"
                onPress={onClose}
                isDisabled={saving}
              >
                Cancel
              </Button>
            </ActionTooltip>
            <ActionTooltip label="Save tags">
              <Button type="submit" isDisabled={loading || saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </ActionTooltip>
          </div>
        </form>
      )}
    </DummyModal>
  );
}
