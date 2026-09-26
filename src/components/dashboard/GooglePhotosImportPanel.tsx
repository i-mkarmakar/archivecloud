"use client";

import { Button, toast } from "@heroui/react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { ProviderBrandIcon } from "@/components/ProviderBrandIcon";
import { ApiRequestError, apiFetch } from "@/lib/api";
import {
  connectOAuthPopup,
  openCenteredPopup,
  writePopupLoading,
} from "@/lib/oauth-connect";
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

type ImportPhase = "idle" | "opening" | "waiting" | "importing" | "done";

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

export const GooglePhotosImportPanel = forwardRef<
  GooglePhotosImportHandle,
  {
    account: ConnectedAccount;
    destinations?: ConnectedAccount[];
    onImported?: () => void;
    /** Hide the big card; toolbar owns the Import button. */
    toolbarMode?: boolean;
  }
>(function GooglePhotosImportPanel(
  { account, onImported, toolbarMode = false },
  ref,
) {
  const [phase, setPhase] = useState<ImportPhase>("idle");
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const pollAbortRef = useRef<AbortController | null>(null);
  const pickerWindowRef = useRef<Window | null>(null);

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
        popupTitle: "Connecting to Google Photos...",
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
    setStatusMessage(null);
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
        setStatusMessage(null);
        return;
      }

      setStatusMessage(
        `Importing ${listed.count} ${listed.count === 1 ? "item" : "items"}…`,
      );

      const result = await apiFetch<{
        imported: number;
        failed: number;
        count: number;
      }>(`/connected-accounts/${account.id}/photos-picker/import`, {
        method: "POST",
        body: JSON.stringify({
          sessionId: session.id,
          mediaItemIds: listed.mediaItems.map((item) => item.id),
        }),
      });

      if (result.imported > 0) {
        toast.success(
          `Successfully imported ${result.imported} ${result.imported === 1 ? "item" : "items"}.`,
        );
      }
      if (result.failed > 0) {
        toast.danger(
          `${result.failed} ${result.failed === 1 ? "item" : "items"} failed to import.`,
        );
      }
      setStatusMessage(null);
      setPhase("idle");
      onImported?.();
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
          : "Failed to import from Google Photos.",
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
    [phase, account.id],
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
    phase === "opening" || phase === "importing" || phase === "waiting";
  const showStatusCard =
    needsReconnect ||
    statusMessage ||
    phase === "waiting" ||
    phase === "opening" ||
    phase === "importing";

  if (toolbarMode && !showStatusCard) {
    return null;
  }

  return (
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
              Select photos or videos from your Google Photos library and import
              them into ArchiveCloud.
            </p>
          </div>
        </div>
      ) : null}

      {needsReconnect ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
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
        className={cn("flex flex-wrap gap-2", !toolbarMode ? "mt-5" : "mt-4")}
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
                ? "Working…"
                : phase === "waiting"
                  ? "Waiting for selection…"
                  : "Import from Google Photos"}
          </Button>
        ) : null}
      </div>
    </div>
  );
});
