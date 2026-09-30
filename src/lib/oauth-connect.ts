export const OAUTH_CONNECT_MESSAGE_HANDLERS: Record<
  string,
  { success: string; failure: string }
> = {
  GOOGLE_CONNECTED: {
    success: "Google Drive connected.",
    failure: "Google Drive connection failed.",
  },
  DROPBOX_CONNECTED: {
    success: "Dropbox connected.",
    failure: "Dropbox connection failed.",
  },
  ONEDRIVE_CONNECTED: {
    success: "OneDrive connected.",
    failure: "OneDrive connection failed.",
  },
  GOOGLE_PHOTOS_CONNECTED: {
    success: "Google Photos connected.",
    failure: "Google Photos connection failed.",
  },
  GOOGLE_SHARED_CONNECTED: {
    success: "Google Shared Drive connected.",
    failure: "Google Shared Drive connection failed.",
  },
  PCLOUD_CONNECTED: {
    success: "pCloud connected.",
    failure: "pCloud connection failed.",
  },
};

export const OAUTH_CONNECT_STORAGE_KEY = "archivecloud:oauth-connect-result";

export type OAuthConnectResultPayload = {
  type: string;
  status: string;
  accountId?: string;
  at: number;
};

/** Notify opener via postMessage + localStorage (storage event survives lost opener). */
export function publishOAuthConnectResult(payload: {
  type: string;
  status: string;
  accountId?: string | null;
}) {
  const message = {
    type: payload.type,
    status: payload.status,
    ...(payload.accountId ? { accountId: payload.accountId } : {}),
  };
  try {
    window.opener?.postMessage(message, window.location.origin);
  } catch {
    // ignore
  }
  try {
    const stored: OAuthConnectResultPayload = {
      ...message,
      at: Date.now(),
    };
    localStorage.setItem(OAUTH_CONNECT_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // ignore
  }
}

/** Open a popup centered on the current browser window. */
export function openCenteredPopup(
  url: string,
  name: string,
  width = 540,
  height = 720,
): Window | null {
  const dualScreenLeft = window.screenLeft ?? window.screenX ?? 0;
  const dualScreenTop = window.screenTop ?? window.screenY ?? 0;
  const viewportWidth =
    window.innerWidth ||
    document.documentElement.clientWidth ||
    window.screen.width;
  const viewportHeight =
    window.innerHeight ||
    document.documentElement.clientHeight ||
    window.screen.height;
  const left = Math.max(
    0,
    Math.round(dualScreenLeft + (viewportWidth - width) / 2),
  );
  const top = Math.max(
    0,
    Math.round(dualScreenTop + (viewportHeight - height) / 2),
  );
  const features = [
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    "resizable=yes",
    "scrollbars=yes",
  ].join(",");
  return window.open(url, name, features);
}

/** Write a simple loading page into a popup (about:blank). */
export function writePopupLoading(
  popup: Window,
  title: string,
  subtitle = "Please wait",
) {
  try {
    popup.document.open();
    popup.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${title}</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
    font-family:system-ui,-apple-system,sans-serif;background:#fff;color:#374151;text-align:center}
  h1{margin:0;font-size:1.25rem;font-weight:600;color:#111827}
  p{margin:.5rem 0 0;font-size:.875rem;color:#9ca3af}
</style></head>
<body><div><h1>${title}</h1><p>${subtitle}</p></div></body></html>`);
    popup.document.close();
  } catch {
    // Cross-origin or closed popup — ignore.
  }
}

export type OAuthPopupWaitResult = {
  status: "success" | "failure" | "closed" | "redirect";
  type?: string;
  accountId?: string;
};

function readStoredOAuthResult(
  startedAt: number,
): OAuthConnectResultPayload | null {
  try {
    const raw = localStorage.getItem(OAUTH_CONNECT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OAuthConnectResultPayload;
    if (!parsed?.type || !parsed?.status || !parsed?.at) return null;
    if (parsed.at < startedAt - 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Wait until popup reports success/failure, writes storage, or is closed. */
export function waitForOAuthPopupResult(
  popup: Window,
  options?: { timeoutMs?: number },
): Promise<OAuthPopupWaitResult> {
  const timeoutMs = options?.timeoutMs ?? 5 * 60 * 1000;
  const startedAt = Date.now();

  return new Promise((resolve) => {
    let done = false;

    function finish(result: OAuthPopupWaitResult) {
      if (done) return;
      done = true;
      window.removeEventListener("message", onMessage);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(pollId);
      window.clearTimeout(timeoutId);
      try {
        localStorage.removeItem(OAUTH_CONNECT_STORAGE_KEY);
      } catch {
        // ignore
      }
      resolve(result);
    }

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const type = event.data?.type as string | undefined;
      if (!type || !(type in OAUTH_CONNECT_MESSAGE_HANDLERS)) return;
      const status = event.data.status === "success" ? "success" : "failure";
      finish({
        status,
        type,
        accountId:
          typeof event.data.accountId === "string"
            ? event.data.accountId
            : undefined,
      });
    }

    function onStorage(event: StorageEvent) {
      if (event.key !== OAUTH_CONNECT_STORAGE_KEY || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as OAuthConnectResultPayload;
        if (!parsed?.type || parsed.at < startedAt - 1000) return;
        finish({
          status: parsed.status === "success" ? "success" : "failure",
          type: parsed.type,
          accountId: parsed.accountId,
        });
      } catch {
        // ignore
      }
    }

    const pollId = window.setInterval(() => {
      const stored = readStoredOAuthResult(startedAt);
      if (stored) {
        finish({
          status: stored.status === "success" ? "success" : "failure",
          type: stored.type,
          accountId: stored.accountId,
        });
        return;
      }
      try {
        if (popup.closed) {
          finish({ status: "closed" });
        }
      } catch {
        finish({ status: "closed" });
      }
    }, 400);

    const timeoutId = window.setTimeout(() => {
      finish({ status: "closed" });
    }, timeoutMs);

    window.addEventListener("message", onMessage);
    window.addEventListener("storage", onStorage);
  });
}

/**
 * Open provider OAuth in a popup and wait for completion.
 * Falls back to same-tab redirect when popups are blocked.
 */
export async function connectOAuthPopup(options: {
  connectUrlPath: string;
  popupName: string;
}): Promise<OAuthPopupWaitResult> {
  const url = new URL(options.connectUrlPath, window.location.origin);
  if (url.pathname === "/connected-accounts/google/connect-url") {
    url.pathname = "/connected-accounts/google/connect";
  }
  const path = `${url.pathname}${url.search}`;

  try {
    localStorage.removeItem(OAUTH_CONNECT_STORAGE_KEY);
  } catch {
    // ignore
  }

  const popup = openCenteredPopup(path, options.popupName);
  if (!popup) {
    window.location.assign(path);
    return { status: "redirect" };
  }
  return waitForOAuthPopupResult(popup);
}

/** Same-tab Google OAuth (full account chooser), like All Cloud Hub. */
export function connectOAuthRedirect(options: {
  connectUrlPath: string;
  returnTo?: string;
}): void {
  const url = new URL(options.connectUrlPath, window.location.origin);
  if (url.pathname === "/connected-accounts/google/connect-url") {
    url.pathname = "/connected-accounts/google/connect";
  }
  if (options.returnTo?.startsWith("/") && !options.returnTo.startsWith("//")) {
    url.searchParams.set("returnTo", options.returnTo);
  }
  try {
    localStorage.removeItem(OAUTH_CONNECT_STORAGE_KEY);
  } catch {
    // ignore
  }
  window.location.assign(`${url.pathname}${url.search}`);
}

export function isGoogleOAuthProvider(providerId: string) {
  return (
    providerId === "google_drive" ||
    providerId === "google_photos" ||
    providerId === "google_shared_drive"
  );
}
