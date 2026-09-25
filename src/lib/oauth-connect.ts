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

export async function connectOAuthPopup(options: {
  connectUrlPath: string;
  popupName: string;

  popupTitle?: string;
}): Promise<void> {
  const url = new URL(options.connectUrlPath, window.location.origin);
  if (url.pathname === "/connected-accounts/google/connect-url") {
    url.pathname = "/connected-accounts/google/connect";
  }
  const path = `${url.pathname}${url.search}`;

  const popup = openCenteredPopup(path, options.popupName);
  if (!popup) {
    window.location.assign(path);
  }
}
