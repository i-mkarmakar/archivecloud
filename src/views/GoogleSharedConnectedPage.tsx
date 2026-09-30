"use client";

import { OAuthConnectResult } from "@/components/OAuthConnectResult";

export function GoogleSharedConnectedPage() {
  return (
    <OAuthConnectResult
      messageType="GOOGLE_SHARED_CONNECTED"
      errorDetail={(reason) =>
        reason === "auth_required"
          ? "Sign in to Archive Cloud, then connect Google Shared Drive again."
          : reason === "session_mismatch"
            ? "This connect link belongs to a different account. Start connect from Settings while signed in."
            : reason === "no_shared_drives"
              ? "No shared drives were found on this Google account."
              : "Try connecting again from Archive Cloud."
      }
    />
  );
}
