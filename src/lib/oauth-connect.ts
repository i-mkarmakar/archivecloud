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

  const popup = window.open(path, options.popupName, "width=540,height=720");
  if (!popup) {
    window.location.assign(path);
  }
}
