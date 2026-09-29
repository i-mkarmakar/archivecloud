"use client";

import { OAuthConnectResult } from "@/components/OAuthConnectResult";

export function PCloudConnectedPage() {
  return (
    <OAuthConnectResult
      messageType="PCLOUD_CONNECTED"
      errorDetail={(reason) =>
        reason === "auth_required"
          ? "Sign in to Archive Cloud, then connect pCloud again."
          : reason === "session_mismatch"
            ? "This connect link belongs to a different account. Start connect from Settings while signed in."
            : reason === "profile"
              ? "pCloud signed in, but we could not read the account profile. Try again, or check PCLOUD_CLIENT_ID / PCLOUD_CLIENT_SECRET."
              : "Close this window and try again."
      }
    />
  );
}
