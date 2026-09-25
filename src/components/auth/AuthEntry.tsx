"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppPreloader } from "@/components/AppPreloader";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/login-form";
import { markAppBoot } from "@/lib/app-boot";
import { authClient } from "@/lib/auth-client";
import { safeCallbackUrl } from "@/lib/safe-callback-url";

/**
 * Full-page AppPreloader while session resolves, OAuth redirect, or after
 * sign-in/up — avoids flashing AuthShell's right-side panel.
 */
export function AuthEntry({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    data: session,
    isPending: sessionPending,
    isRefetching: sessionRefetching,
  } = authClient.useSession();
  const [enteringApp, setEnteringApp] = useState(false);
  const [overlay, setOverlay] = useState(false);
  const redirectPath = safeCallbackUrl(searchParams.get("callbackUrl"));

  useEffect(() => {
    // Wait out pending/refetch so a just-signed-out stale session does not
    // immediately bounce into the app preloader → /home loop.
    if (sessionPending || sessionRefetching) return;
    if (!session) {
      if (enteringApp) setEnteringApp(false);
      return;
    }
    if (enteringApp) return;
    markAppBoot();
    setEnteringApp(true);
    router.replace(redirectPath);
    router.refresh();
  }, [
    session,
    sessionPending,
    sessionRefetching,
    enteringApp,
    redirectPath,
    router,
  ]);

  function handleEnterApp(path: string = redirectPath) {
    markAppBoot();
    setEnteringApp(true);
    router.replace(path);
    router.refresh();
  }

  if (
    sessionPending ||
    sessionRefetching ||
    enteringApp ||
    overlay ||
    session
  ) {
    return <AppPreloader />;
  }

  return (
    <AuthShell>
      <LoginForm
        mode={mode}
        onEnterApp={handleEnterApp}
        onShowOverlay={setOverlay}
      />
    </AuthShell>
  );
}
