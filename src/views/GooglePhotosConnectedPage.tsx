"use client";

import { OAuthConnectResult } from "@/components/OAuthConnectResult";

export function GooglePhotosConnectedPage() {
  return (
    <OAuthConnectResult
      messageType="GOOGLE_PHOTOS_CONNECTED"
      errorDetail={(reason) =>
        reason === "auth_required"
          ? "Sign in to Archive Cloud, then connect Google Photos again."
          : reason === "session_mismatch"
            ? "This connect link belongs to a different account. Start connect from Settings while signed in."
            : "Close this window and try again."
      }
    />
  );
}
