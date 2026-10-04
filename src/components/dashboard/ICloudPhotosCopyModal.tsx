"use client";

import { Button, toast } from "@heroui/react";
import { useMemo, useState } from "react";
import { DummyModal } from "@/components/drive/DummyModal";
import { ProviderBrandIcon } from "@/components/ProviderBrandIcon";
import { apiFetch } from "@/lib/api";
import { providerLabel } from "@/lib/providers";
import { cn } from "@/lib/utils";

type DestAccount = {
  id: string;
  provider: string;
  displayName?: string | null;
  email?: string | null;
};

type CopyFile = {
  name: string;
  providerFileId: string;
};

export function ICloudPhotosCopyModal({
  open,
  onClose,
  sourceAccountId,
  files,
  destinations,
  mode = "copy",
  onQueued,
}: {
  open: boolean;
  onClose: () => void;
  sourceAccountId: string;
  files: CopyFile[];
  destinations: DestAccount[];
  mode?: "copy" | "move";
  onQueued?: () => void;
}) {
  const copyDestinations = useMemo(
    () => destinations.filter((d) => d.id !== sourceAccountId),
    [destinations, sourceAccountId],
  );

  const [destAccountId, setDestAccountId] = useState<string | null>(
    copyDestinations[0]?.id ?? null,
  );
  const [busy, setBusy] = useState(false);
  const actionLabel = mode === "move" ? "Move" : "Copy";

  async function queueTransfers() {
    if (!destAccountId || files.length === 0) return;
    setBusy(true);
    try {
      let queued = 0;
      for (const file of files) {
        await apiFetch("/transfers", {
          method: "POST",
          body: JSON.stringify({
            sourceAccountId,
            destAccountId,
            sourceProviderFileId: file.providerFileId,
            fileName: file.name,
            destParentId: "root",
            type: mode,
          }),
        });
        queued += 1;
      }
      toast.success(
        queued === 1
          ? `${actionLabel} queued. Check Run History for progress.`
          : `${queued} ${mode}s queued. Check Run History for progress.`,
      );
      onQueued?.();
      onClose();
    } catch (error) {
      toast.danger(
        error instanceof Error ? error.message : `Failed to queue ${mode}.`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <DummyModal
      open={open}
      title={`${actionLabel} to…`}
      description={`${actionLabel} ${files.length} selected ${files.length === 1 ? "item" : "items"} into another cloud.`}
      onClose={onClose}
      size="cover"
      className="w-[min(100%,28rem)] sm:max-w-md"
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          {copyDestinations.length === 0 ? (
            <p className="text-sm text-muted">
              Connect another cloud account to {mode} into.
            </p>
          ) : (
            copyDestinations.map((dest) => {
              const active = destAccountId === dest.id;
              return (
                <button
                  key={dest.id}
                  type="button"
                  onClick={() => setDestAccountId(dest.id)}
                  className={cn(
                    "inline-flex h-9 max-w-[14rem] cursor-pointer items-center gap-2 rounded-full border px-3 text-sm font-semibold transition",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-white text-foreground hover:bg-black/5",
                  )}
                >
                  <ProviderBrandIcon
                    name={dest.provider}
                    className="h-4 w-4 shrink-0"
                    fallback={
                      <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-primary/10 text-[9px] font-bold text-primary">
                        {providerLabel(dest.provider).charAt(0)}
                      </span>
                    }
                  />
                  <span className="truncate">
                    {dest.displayName?.trim() ||
                      dest.email ||
                      providerLabel(dest.provider)}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onPress={onClose} isDisabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onPress={() => void queueTransfers()}
            isDisabled={busy || !destAccountId || files.length === 0}
          >
            {busy ? "Queuing…" : `Start ${mode}`}
          </Button>
        </div>
      </div>
    </DummyModal>
  );
}
