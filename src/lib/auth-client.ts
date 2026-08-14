import { createAuthClient } from "better-auth/react";
import {
  emailOTPClient,
  inferAdditionalFields,
} from "better-auth/client/plugins";

import type { Auth } from "@/lib/auth";

export const authClient = createAuthClient({
  baseURL:
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.BETTER_AUTH_URL ||
    (typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:9050"),
  plugins: [inferAdditionalFields<Auth>(), emailOTPClient()],
});
