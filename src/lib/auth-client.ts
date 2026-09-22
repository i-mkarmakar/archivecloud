import { createAuthClient } from "better-auth/react";
import {
  emailOTPClient,
  inferAdditionalFields,
} from "better-auth/client/plugins";

import type { Auth } from "@/lib/auth";

export const authClient = createAuthClient({
  // Prefer the current page origin so ngrok/public tunnels don't call localhost
  // from a public HTTPS page (browser blocks that → Failed to fetch).
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ||
        process.env.BETTER_AUTH_URL ||
        "http://localhost:9050",
  plugins: [inferAdditionalFields<Auth>(), emailOTPClient()],
});
