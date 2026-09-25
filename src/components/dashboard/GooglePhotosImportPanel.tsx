"use client";

import { Button, toast } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { ProviderBrandIcon } from "@/components/ProviderBrandIcon";
import { ApiRequestError, apiFetch } from "@/lib/api";
import { connectOAuthPopup, openCenteredPopup } from "@/lib/oauth-connect";
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
  | "importing"
  | "ready"
  | "done";

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

export function GooglePhotosImportPanel({
  account,
  destinations,
  onImported,
}: {
  account: ConnectedAccount;
  destinations: ConnectedAccount[];
  onImported?: () => void;
}) {
  const [phase, setPhase] = useState<ImportPhase>("idle");
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<PickedMediaItem[]>([]);
  const [destAccountId, setDestAccountId] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const pollAbortRef = useRef<AbortController | null>(null);
  const pickerWindowRef = useRef<Window | null>(null);

  const otherDestinations = destinations.filter(
    (item) => item.id !== account.id && item.provider !== "google_photos",
  );
  const defaultDestId = otherDestinations[0]?.id ?? "";

  useEffect(() => {
    if (!destAccountId && defaultDestId) {
      setDestAccountId(defaultDestId);
    }
  }, [destAccountId, defaultDestId]);

  useEffect(() => {
    return () => {
      pollAbortRef.current?.abort();
      if (pickerWindowRef.current && !pickerWindowRef.current.closed) {
        pickerWindowRef.current.close();
      }
    };
  }, []);

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
      await connectOAuthPopup({
        connectUrlPath: "/connected-accounts/google-photos/connect-url",
        popupName: "google-photos-connect",
      });
      setNeedsReconnect(false);
      setStatusMessage(null);
      toast.success("Reconnect Google Photos in the popup, then try again.");
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
        `/connected-accounts/${account.id}/photos-picker/session/${encodeURIComponent(activeSessionId)}`,
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

  async function startImportFlow() {
    pollAbortRef.current?.abort();
    const abort = new AbortController();
    pollAbortRef.current = abort;

    setNeedsReconnect(false);
    setSelectedItems([]);
    setSessionId(null);
    setStatusMessage(null);
    setPhase("opening");

    try {
      const created = await apiFetch<PickerSessionResponse>(
        `/connected-accounts/${account.id}/photos-picker/session`,
        {
          method: "POST",
          body: JSON.stringify({ maxItemCount: 50 }),
        },
      );

      const { session } = created;
      setSessionId(session.id);

      const popup = openCenteredPopup(
        session.pickerUri,
        "google-photos-picker",
        960,
        720,
      );
      pickerWindowRef.current = popup;
      if (!popup) {
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

      setPhase("importing");
      setStatusMessage("Importing selected photos…");

      const listed = await apiFetch<{
        mediaItemsSet: boolean;
        mediaItems: PickedMediaItem[];
        count: number;
      }>(
        `/connected-accounts/${account.id}/photos-picker/media-items/${encodeURIComponent(session.id)}`,
      );

      if (!listed.mediaItems.length) {
        setPhase("idle");
        setSessionId(null);
        setStatusMessage(null);
        return;
      }

      setSelectedItems(listed.mediaItems);
      setPhase("ready");
      setStatusMessage(
        `${listed.count} ${listed.count === 1 ? "item" : "items"} selected`,
      );
    } catch (error) {
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
        setSessionId(null);
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
          : "Failed to open Google Photos Picker.",
      );
    }
  }

  async function importSelected() {
    if (!sessionId || !destAccountId || selectedItems.length === 0) return;
    setPhase("importing");
    setStatusMessage("Importing selected photos…");

    try {
      const result = await apiFetch<{
        imported: number;
        failed: number;
        count: number;
      }>(`/connected-accounts/${account.id}/photos-picker/import`, {
        method: "POST",
        body: JSON.stringify({
          sessionId,
          destAccountId,
          mediaItemIds: selectedItems.map((item) => item.id),
        }),
      });

      setPhase("done");
      if (result.imported > 0) {
        toast.success(
          `Imported ${result.imported} ${result.imported === 1 ? "item" : "items"} from Google Photos.`,
        );
      }
      if (result.failed > 0) {
        toast.danger(
          `${result.failed} ${result.failed === 1 ? "item" : "items"} failed to import.`,
        );
      }
      setStatusMessage(
        result.imported > 0
          ? `Imported ${result.imported} of ${result.count}.`
          : "No items were imported.",
      );
      onImported?.();
    } catch (error) {
      if (handleScopeError(error)) return;
      setPhase("ready");
      toast.danger(
        error instanceof Error
          ? error.message
          : "Failed to import selected photos.",
      );
    }
  }

  function cancelWaiting() {
    pollAbortRef.current?.abort();
    if (pickerWindowRef.current && !pickerWindowRef.current.closed) {
      pickerWindowRef.current.close();
    }
    setPhase("idle");
    setSessionId(null);
    setSelectedItems([]);
    setStatusMessage(null);
  }

  return (
    <div className="rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-secondary">
          <ProviderBrandIcon name="google_photos" className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-foreground">
            Google Photos
          </h2>
          <p className="mt-1 text-sm text-muted">
            Select photos or videos from your Google Photos library and import
            them into ArchiveCloud.
          </p>
        </div>
      </div>

      {needsReconnect ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p>
            Google Photos permission needs to be updated. Please reconnect your
            Google account and allow Google Photos access.
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
        <p className="mt-4 text-sm font-medium text-foreground">
          {statusMessage}
        </p>
      ) : null}

      {phase === "ready" && selectedItems.length > 0 ? (
        <div className="mt-4 space-y-3">
          <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl bg-surface-secondary p-3 text-sm text-foreground">
            {selectedItems.slice(0, 20).map((item) => (
              <li key={item.id} className="truncate">
                {item.filename}
              </li>
            ))}
            {selectedItems.length > 20 ? (
              <li className="text-muted">+{selectedItems.length - 20} more</li>
            ) : null}
          </ul>

          {otherDestinations.length === 0 ? (
            <p className="text-sm text-muted">
              Connect another cloud account (for example Google Drive) to import
              selected media into.
            </p>
          ) : (
            <label className="block text-sm font-medium text-foreground">
              Import to
              <select
                className="mt-1.5 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm"
                value={destAccountId}
                onChange={(event) => setDestAccountId(event.target.value)}
              >
                {otherDestinations.map((dest) => (
                  <option key={dest.id} value={dest.id}>
                    {providerLabel(dest.provider)} ·{" "}
                    {dest.displayName?.trim() || dest.email}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {phase === "waiting" ? (
          <Button variant="outline" onPress={cancelWaiting}>
            Cancel
          </Button>
        ) : null}

        {phase === "ready" ? (
          <>
            <Button
              variant="primary"
              isDisabled={!destAccountId || otherDestinations.length === 0}
              onPress={() => {
                void importSelected();
              }}
            >
              Import selected
            </Button>
            <Button
              variant="outline"
              onPress={() => {
                void startImportFlow();
              }}
            >
              Select again
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            className={cn(
              phase === "opening" || phase === "importing" ? "opacity-80" : "",
            )}
            isDisabled={
              phase === "opening" ||
              phase === "importing" ||
              phase === "waiting"
            }
            onPress={() => {
              void startImportFlow();
            }}
          >
            {phase === "opening"
              ? "Opening picker…"
              : phase === "importing"
                ? "Working…"
                : phase === "waiting"
                  ? "Waiting for selection…"
                  : "Import from Google Photos"}
          </Button>
        )}
      </div>
    </div>
  );
}
