"use client";

import { Folder } from "@gravity-ui/icons";
import { Button, toast } from "@heroui/react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DummyModal,
  modalActionButtonClassName,
  modalActionsClassName,
} from "@/components/drive/DummyModal";
import { ProviderBrandIcon } from "@/components/ProviderBrandIcon";
import { ApiRequestError, apiFetch } from "@/lib/api";
import {
  connectOAuthRedirect,
  openCenteredPopup,
  writePopupLoading,
} from "@/lib/oauth-connect";
import { providerLabel } from "@/lib/providers";
import { cn } from "@/lib/utils";
import type { ConnectedAccount } from "@/views/all-files/types";

type PickerSessionResponse = {
  session: {
    id: string;
    pickerUri: string;
    expireTime: string | null;
    mediaItemsSet: boolean;
    pollingConfig: {
      pollIntervalSeconds: number;
      pollInterval: string | null;
      timeoutIn: string | null;
    };
  };
};

type PickedMediaItem = {
  id: string;
  type: string;
  createTime: string | null;
  filename: string;
  mimeType: string;
};

type ImportPhase =
  | "idle"
  | "opening"
  | "waiting"
  | "choosing-dest"
  | "importing"
  | "done";

type PendingCopy = {
  sessionId: string;
  mediaItemIds: string[];
  count: number;
};

type BrowseFolder = { id: string; name: string };

export type GooglePhotosImportHandle = {
  startImport: () => void;
  phase: ImportPhase;
};

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = window.setTimeout(() => resolve(), ms);
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

function accountTitle(account: ConnectedAccount) {
  return account.displayName?.trim() || `My ${providerLabel(account.provider)}`;
}

export const GooglePhotosImportPanel = forwardRef<
  GooglePhotosImportHandle,
  {
    account: ConnectedAccount;
    destinations?: ConnectedAccount[];
    onImported?: () => void;
    /** Hide the big card; toolbar owns the Copy button. */
    toolbarMode?: boolean;
  }
>(function GooglePhotosImportPanel(
  { account, destinations = [], onImported, toolbarMode = false },
  ref,
) {
  const [phase, setPhase] = useState<ImportPhase>("idle");
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingCopy | null>(null);
  const [destAccountId, setDestAccountId] = useState<string | null>(null);
  const [parentId, setParentId] = useState("root");
  const [breadcrumbs, setBreadcrumbs] = useState<
    Array<{ id: string; name: string }>
  >([{ id: "root", name: "Root" }]);
  const [folders, setFolders] = useState<BrowseFolder[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [copying, setCopying] = useState(false);
  const pollAbortRef = useRef<AbortController | null>(null);
  const pickerWindowRef = useRef<Window | null>(null);

  const copyDestinations = useMemo(
    () =>
      destinations.filter(
        (item) =>
          item.status === "connected" &&
          item.provider !== "google_photos" &&
          item.id !== account.id,
      ),
    [destinations, account.id],
  );

  useEffect(() => {
    return () => {
      pollAbortRef.current?.abort();
      if (pickerWindowRef.current && !pickerWindowRef.current.closed) {
        pickerWindowRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (phase !== "choosing-dest" || !destAccountId) {
      setFolders([]);
      return;
    }

    let cancelled = false;
    async function loadBrowse() {
      setBrowseLoading(true);
      try {
        const data = await apiFetch<{
          folders: Array<{ id: string; name: string }>;
          breadcrumbs?: Array<{ id: string; name: string }>;
        }>(
          `/connected-accounts/${destAccountId}/browse?parentId=${encodeURIComponent(parentId)}&limit=80`,
        );
        if (cancelled) return;
        setFolders(data.folders ?? []);
        const dest = copyDestinations.find((item) => item.id === destAccountId);
        const rootName = dest ? accountTitle(dest) : "Cloud";
        if (data.breadcrumbs?.length) {
          setBreadcrumbs([
            { id: "root", name: rootName },
            ...data.breadcrumbs
              .filter(
                (crumb) => crumb.id && crumb.id !== "root" && crumb.id !== "0",
              )
              .map((crumb) => ({ id: crumb.id, name: crumb.name })),
          ]);
        } else if (parentId === "root") {
          setBreadcrumbs([{ id: "root", name: rootName }]);
        }
      } catch (error) {
        if (!cancelled) {
          setFolders([]);
          toast.danger(
            error instanceof Error ? error.message : "Failed to load folders",
          );
        }
      } finally {
        if (!cancelled) setBrowseLoading(false);
      }
    }

    void loadBrowse();
    return () => {
      cancelled = true;
    };
  }, [phase, destAccountId, parentId, copyDestinations]);

  function handleScopeError(error: unknown) {
    if (
      error instanceof ApiRequestError &&
      error.code === "PHOTOS_PICKER_SCOPE_MISSING"
    ) {
      setNeedsReconnect(true);
      setPhase("idle");
      setStatusMessage(
        "Google Photos permission needs to be updated. Please reconnect your Google account and allow Google Photos access.",
      );
      return true;
    }
    return false;
  }

  async function reconnectGooglePhotos() {
    try {
      connectOAuthRedirect({
        connectUrlPath: "/connected-accounts/google-photos/connect-url",
        returnTo: `${window.location.pathname}${window.location.search}`,
      });
    } catch (error) {
      toast.danger(
        error instanceof Error
          ? error.message
          : "Failed to start Google Photos reconnect.",
      );
    }
  }

  async function pollUntilReady(
    activeSessionId: string,
    pollIntervalSeconds: number,
    expireTime: string | null,
    signal: AbortSignal,
  ) {
    while (!signal.aborted) {
      if (expireTime && new Date(expireTime).getTime() < Date.now()) {
        throw new ApiRequestError(
          "Your Google Photos selection session expired. Please try again.",
          410,
          "PHOTOS_PICKER_SESSION_EXPIRED",
        );
      }

      const data = await apiFetch<PickerSessionResponse>(
        `/connected-accounts/${account.id}/photos-picker/session?sessionId=${encodeURIComponent(activeSessionId)}`,
      );

      if (data.session.mediaItemsSet) {
        return data.session;
      }

      const intervalMs =
        (data.session.pollingConfig.pollIntervalSeconds ||
          pollIntervalSeconds ||
          5) * 1000;
      await sleep(intervalMs, signal);
    }
    throw new DOMException("Aborted", "AbortError");
  }

  function resetDestState(nextDestId: string | null) {
    setDestAccountId(nextDestId);
    setParentId("root");
    const dest = copyDestinations.find((item) => item.id === nextDestId);
    setBreadcrumbs([{ id: "root", name: dest ? accountTitle(dest) : "Root" }]);
    setFolders([]);
  }

  function openDestChooser(next: PendingCopy) {
    setPending(next);
    const first = copyDestinations[0]?.id ?? null;
    resetDestState(first);
    setPhase("choosing-dest");
    setStatusMessage(
      `Choose where to copy ${next.count} ${next.count === 1 ? "item" : "items"}.`,
    );
  }

  function cancelDestChooser() {
    setPending(null);
    setDestAccountId(null);
    setPhase("idle");
    setStatusMessage(null);
    setCopying(false);
  }

  async function confirmCopyHere() {
    if (!pending || !destAccountId) return;
    setCopying(true);
    setPhase("importing");
    setStatusMessage(
      `Queuing ${pending.count} ${pending.count === 1 ? "copy" : "copies"}…`,
    );

    try {
      const result = await apiFetch<{
        imported: number;
        queued?: number;
        failed: number;
        count: number;
      }>(`/connected-accounts/${account.id}/photos-picker/import`, {
        method: "POST",
        body: JSON.stringify({
          sessionId: pending.sessionId,
          mediaItemIds: pending.mediaItemIds,
          destAccountId,
          destParentId: parentId === "root" ? null : parentId,
        }),
      });

      const queued = result.queued ?? result.imported;
      if (queued > 0) {
        toast.success(
          `Queued ${queued} ${queued === 1 ? "copy" : "copies"}. Track progress in Run History.`,
        );
      }
      if (result.failed > 0) {
        toast.danger(
          `${result.failed} ${result.failed === 1 ? "item" : "items"} failed to queue.`,
        );
      }
      setPending(null);
      setDestAccountId(null);
      setStatusMessage(null);
      setPhase("idle");
      onImported?.();
    } catch (error) {
      setPhase("choosing-dest");
      setStatusMessage(
        pending
          ? `Choose where to copy ${pending.count} ${pending.count === 1 ? "item" : "items"}.`
          : null,
      );
      toast.danger(
        error instanceof Error
          ? error.message
          : "Failed to copy from Google Photos.",
      );
    } finally {
      setCopying(false);
    }
  }

  async function startImportFlow() {
    pollAbortRef.current?.abort();
    const abort = new AbortController();
    pollAbortRef.current = abort;

    setNeedsReconnect(false);
    setStatusMessage(null);
    setPending(null);

    if (copyDestinations.length === 0) {
      toast.danger(
        "Connect another cloud (Drive, OneDrive, Dropbox, etc.) to copy photos into.",
      );
      return;
    }

    setPhase("opening");

    const popup = openCenteredPopup(
      "about:blank",
      "google-photos-picker",
      960,
      720,
    );
    pickerWindowRef.current = popup;
    if (popup) {
      writePopupLoading(popup, "Opening Google Photos...", "Please wait");
    }

    try {
      const created = await apiFetch<PickerSessionResponse>(
        `/connected-accounts/${account.id}/photos-picker/session`,
        {
          method: "POST",
          body: JSON.stringify({ maxItemCount: 50 }),
        },
      );

      const { session } = created;

      if (popup && !popup.closed) {
        popup.location.href = session.pickerUri;
      } else {
        window.location.assign(session.pickerUri);
        return;
      }

      setPhase("waiting");
      setStatusMessage("Select photos or videos in Google Photos…");

      await pollUntilReady(
        session.id,
        session.pollingConfig.pollIntervalSeconds,
        session.expireTime,
        abort.signal,
      );

      if (popup && !popup.closed) {
        popup.close();
      }

      const listed = await apiFetch<{
        mediaItemsSet: boolean;
        mediaItems: PickedMediaItem[];
        count: number;
      }>(
        `/connected-accounts/${account.id}/photos-picker/media-items?sessionId=${encodeURIComponent(session.id)}`,
      );

      if (!listed.mediaItems.length) {
        setPhase("idle");
        setStatusMessage(null);
        return;
      }

      openDestChooser({
        sessionId: session.id,
        mediaItemIds: listed.mediaItems.map((item) => item.id),
        count: listed.count,
      });
    } catch (error) {
      if (popup && !popup.closed) {
        popup.close();
      }
      if (error instanceof DOMException && error.name === "AbortError") {
        setPhase("idle");
        setStatusMessage(null);
        return;
      }
      if (handleScopeError(error)) return;
      if (
        error instanceof ApiRequestError &&
        error.code === "PHOTOS_PICKER_SESSION_EXPIRED"
      ) {
        setPhase("idle");
        setStatusMessage(
          "Your Google Photos selection session expired. Please try again.",
        );
        return;
      }
      setPhase("idle");
      setStatusMessage(null);
      toast.danger(
        error instanceof Error
          ? error.message
          : "Failed to copy from Google Photos.",
      );
    }
  }

  useImperativeHandle(
    ref,
    () => ({
      startImport: () => {
        void startImportFlow();
      },
      phase,
    }),
    [phase, account.id, copyDestinations],
  );

  function cancelWaiting() {
    pollAbortRef.current?.abort();
    if (pickerWindowRef.current && !pickerWindowRef.current.closed) {
      pickerWindowRef.current.close();
    }
    setPhase("idle");
    setStatusMessage(null);
  }

  const busy =
    phase === "opening" ||
    phase === "importing" ||
    phase === "waiting" ||
    phase === "choosing-dest";
  const showStatusCard =
    needsReconnect ||
    statusMessage ||
    phase === "waiting" ||
    phase === "opening" ||
    phase === "importing";

  const locationLabel = breadcrumbs.map((crumb) => crumb.name).join(" / ");

  return (
    <>
      {toolbarMode && !showStatusCard ? null : (
        <div
          className={cn(
            "rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6",
            toolbarMode ? "mb-6" : "",
          )}
        >
          {!toolbarMode ? (
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-secondary">
                <ProviderBrandIcon name="google_photos" className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-foreground">
                  Google Photos
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Select photos or videos, then choose a destination cloud to
                  copy them into.
                </p>
              </div>
            </div>
          ) : null}

          {needsReconnect ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p>
                Google Photos permission needs to be updated. Please reconnect
                your Google account and allow Google Photos access.
              </p>
              <Button
                className="mt-3"
                size="sm"
                variant="primary"
                onPress={() => {
                  void reconnectGooglePhotos();
                }}
              >
                Reconnect Google Photos
              </Button>
            </div>
          ) : null}

          {statusMessage && !needsReconnect ? (
            <p
              className={cn(
                "text-sm font-medium text-foreground",
                !toolbarMode && "mt-4",
              )}
            >
              {statusMessage}
            </p>
          ) : null}

          <div
            className={cn(
              "flex flex-wrap gap-2",
              !toolbarMode ? "mt-5" : "mt-4",
            )}
          >
            {phase === "waiting" ? (
              <Button variant="outline" onPress={cancelWaiting}>
                Cancel
              </Button>
            ) : null}

            {!toolbarMode ? (
              <Button
                variant="primary"
                className={cn(busy ? "opacity-80" : "")}
                isDisabled={busy}
                onPress={() => {
                  void startImportFlow();
                }}
              >
                {phase === "opening"
                  ? "Opening picker…"
                  : phase === "importing"
                    ? "Queuing…"
                    : phase === "waiting"
                      ? "Waiting for selection…"
                      : phase === "choosing-dest"
                        ? "Choose destination…"
                        : "Copy from Google Photos"}
              </Button>
            ) : null}
          </div>
        </div>
      )}

      <DummyModal
        open={phase === "choosing-dest" && pending != null}
        title="Copy to…"
        description={
          pending
            ? `Copy ${pending.count} selected ${pending.count === 1 ? "item" : "items"} into another cloud.`
            : undefined
        }
        onClose={cancelDestChooser}
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
            {copyDestinations.map((dest) => {
              const active = destAccountId === dest.id;
              return (
                <button
                  key={dest.id}
                  type="button"
                  onClick={() => resetDestState(dest.id)}
                  className={cn(
                    "inline-flex h-9 max-w-[11rem] cursor-pointer items-center gap-2 rounded-full border px-3 text-sm font-semibold transition",
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
                  <span className="truncate">{accountTitle(dest)}</span>
                </button>
              );
            })}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-1 text-sm">
            {breadcrumbs.map((crumb, index) => (
              <span
                key={`${crumb.id}-${index}`}
                className="flex items-center gap-1"
              >
                {index > 0 ? <span className="text-muted">/</span> : null}
                {index === breadcrumbs.length - 1 ? (
                  <span className="font-semibold text-foreground">
                    {crumb.name}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="cursor-pointer font-semibold text-foreground hover:underline"
                    onClick={() => {
                      setParentId(crumb.id);
                      setBreadcrumbs(breadcrumbs.slice(0, index + 1));
                    }}
                  >
                    {crumb.name}
                  </button>
                )}
              </span>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border bg-white">
            {!destAccountId ? (
              <p className="px-4 py-10 text-center text-sm text-muted">
                Connect another cloud to copy into.
              </p>
            ) : browseLoading ? (
              <p className="px-4 py-10 text-center text-sm text-muted">
                Loading folders…
              </p>
            ) : folders.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted">
                No folders here. You can still copy into this location.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {folders.map((folder) => (
                  <li key={folder.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setParentId(folder.id);
                        setBreadcrumbs((prev) => [
                          ...prev,
                          { id: folder.id, name: folder.name },
                        ]);
                      }}
                      className="flex w-full cursor-pointer items-center gap-3 px-3 py-3 text-left transition hover:bg-black/[0.03] sm:px-4"
                    >
                      <Folder className="h-5 w-5 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                        {folder.name}
                      </span>
                      <span className="shrink-0 text-xs font-bold text-primary">
                        Open
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between sm:pt-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-foreground">
                {locationLabel}
              </p>
              <p className="text-xs text-muted">
                Copy into the current folder (or open a subfolder first)
              </p>
            </div>
            <div className={cn(modalActionsClassName, "shrink-0")}>
              <div className={modalActionButtonClassName}>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  isDisabled={copying}
                  onPress={cancelDestChooser}
                >
                  Cancel
                </Button>
              </div>
              <div className={modalActionButtonClassName}>
                <Button
                  type="button"
                  className="w-full"
                  isDisabled={!destAccountId || copying}
                  onPress={() => {
                    void confirmCopyHere();
                  }}
                >
                  {copying ? "Queuing…" : "Copy Here"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DummyModal>
    </>
  );
});
