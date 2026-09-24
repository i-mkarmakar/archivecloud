"use client";

import { Xmark } from "@gravity-ui/icons";
import { Folder } from "@/components/folder/Folder";
import { ProviderBrandIcon } from "@/components/ProviderBrandIcon";
import type { FolderItem } from "@/data/drive-data";
import { providerLabel } from "@/lib/providers";
import { cn } from "@/lib/utils";

export type FolderDetailsInfo = {
  folder: FolderItem;
  provider?: string | null;
  accountName?: string | null;
  owner?: string | null;
  mimeType?: string | null;
  modified?: string | null;
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="shrink-0 text-sm font-medium text-[#7b879c]">
        {label}
      </span>
      <span className="min-w-0 text-right text-sm font-semibold text-foreground break-words">
        {value}
      </span>
    </div>
  );
}

function folderMimeLabel(provider?: string | null, mimeType?: string | null) {
  if (mimeType) return mimeType;
  const id = (provider ?? "").toLowerCase();
  if (id.includes("google") || id === "drive") {
    return "application/vnd.google-apps.folder (Google Folder)";
  }
  if (id.includes("onedrive") || id.includes("microsoft")) {
    return "folder (OneDrive Folder)";
  }
  if (id.includes("dropbox")) {
    return "folder (Dropbox Folder)";
  }
  if (id.includes("pcloud")) {
    return "folder (pCloud Folder)";
  }
  return "folder";
}

export function FolderDetailsDrawer({
  open,
  details,
  onClose,
  onOpenFolder,
}: {
  open: boolean;
  details: FolderDetailsInfo | null;
  onClose: () => void;
  onOpenFolder?: () => void;
}) {
  const folder = details?.folder ?? null;
  const provider = details?.provider ?? null;
  const providerName = provider ? providerLabel(provider) : "Archive Cloud";

  return (
    <>
      <button
        type="button"
        className={
          open
            ? "fixed inset-0 z-40 bg-backdrop/30"
            : "pointer-events-none fixed inset-0 z-40 bg-backdrop/0"
        }
        aria-label="Close folder details"
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
            {folder?.name ?? "Folder"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close folder details"
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-black/5 hover:text-foreground"
          >
            <Xmark className="h-5 w-5" />
          </button>
        </div>

        {folder ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
            <button
              type="button"
              onClick={onOpenFolder}
              className="flex w-full cursor-pointer flex-col items-center justify-center px-4 py-4 transition-opacity hover:opacity-95"
            >
              <div className="flex h-28 w-full items-center justify-center overflow-hidden">
                <div className="origin-center scale-[0.38]">
                  <Folder color="blue" size="md" />
                </div>
              </div>
              <span className="-mt-1 text-sm font-medium text-[#7b879c]">
                Click to open folder
              </span>
            </button>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">
                Folder
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef1f6] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#4a5568]">
                {provider ? (
                  <ProviderBrandIcon
                    name={provider}
                    className="h-3.5 w-3.5 shrink-0"
                    fallback={
                      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-primary/15 text-[8px] font-bold text-primary">
                        {providerName.charAt(0)}
                      </span>
                    }
                  />
                ) : null}
                {providerName}
              </span>
            </div>

            <div className="mt-6">
              <h3 className="text-base font-extrabold text-foreground">
                Information
              </h3>
              <div className="mt-2 divide-y divide-border/70">
                <InfoRow label="Type" value="Folder" />
                <InfoRow
                  label="Modified"
                  value={details?.modified || folder.updated || "—"}
                />
                <InfoRow label="Owner" value={details?.owner || "You"} />
                <InfoRow
                  label="Account"
                  value={details?.accountName || "—"}
                />
                <InfoRow
                  label="MIME TYPE"
                  value={folderMimeLabel(provider, details?.mimeType)}
                />
              </div>
            </div>
          </div>
        ) : null}
      </aside>
    </>
  );
}
