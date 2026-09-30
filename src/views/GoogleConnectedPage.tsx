"use client";

import { OAuthConnectResult } from "@/components/OAuthConnectResult";

export function GoogleConnectedPage() {
  return (
    <OAuthConnectResult
      messageType="GOOGLE_CONNECTED"
      errorDetail={(reason) =>
        reason === "auth_required"
          ? "Sign in to Archive Cloud, then connect Google Drive again."
          : reason === "session_mismatch"
            ? "This connect link belongs to a different account. Start connect from Settings while signed in."
            : "Try connecting again from Archive Cloud."
      }
    />
  );
}
