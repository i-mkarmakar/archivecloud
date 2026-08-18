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
  const path =
    options.connectUrlPath === "/connected-accounts/google/connect-url"
      ? "/connected-accounts/google/connect"
      : options.connectUrlPath;

  const popup = window.open(path, options.popupName, "width=540,height=720");
  if (!popup) {
    window.location.assign(path);
  }
}
