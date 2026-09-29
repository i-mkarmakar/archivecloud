"use client";

import { OAuthConnectResult } from "@/components/OAuthConnectResult";

export function DropboxConnectedPage() {
  return (
    <OAuthConnectResult
      messageType="DROPBOX_CONNECTED"
      errorDetail={(reason) =>
        reason === "auth_required"
          ? "Sign in to Archive Cloud, then connect Dropbox again."
          : reason === "session_mismatch"
            ? "This connect link belongs to a different account. Start connect from Settings while signed in."
            : "Close this window and try again."
      }
    />
  );
}
