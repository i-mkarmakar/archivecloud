"use client";

import { useEffect, useState } from "react";
import { AppPreloader } from "@/components/AppPreloader";
import { useUserPlan, waitForUserPlan } from "@/hooks/useUserPlan";
import { authClient } from "@/lib/auth-client";
import { APP_BOOT_MIN_MS, consumeAppBoot, hasAppBoot } from "@/lib/app-boot";
import { safeCallbackUrl } from "@/lib/safe-callback-url";
import { usePathname, useRouter } from "next/navigation";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();
  const { loaded: planLoaded } = useUserPlan();
  const [booting, setBooting] = useState(() =>
    typeof window === "undefined" ? false : hasAppBoot(),
  );
  const [planReady, setPlanReady] = useState(false);

  useEffect(() => {
    if (isPending || session) return;
    const safePath = safeCallbackUrl(pathname);
    const callback =
      safePath !== "/home"
        ? `?callbackUrl=${encodeURIComponent(safePath)}`
        : "";
    router.replace(`/auth/sign-in${callback}`);
  }, [isPending, session, router, pathname]);

  useEffect(() => {
    if (isPending || !session) return;
    if (!hasAppBoot()) {
      setBooting(false);
      return;
    }

    setBooting(true);
    const timer = window.setTimeout(() => {
      consumeAppBoot();
      setBooting(false);
    }, APP_BOOT_MIN_MS);

    return () => window.clearTimeout(timer);
  }, [isPending, session]);

  useEffect(() => {
    if (isPending || !session) {
      setPlanReady(false);
      return;
    }

    let cancelled = false;
    void waitForUserPlan().then(() => {
      if (!cancelled) setPlanReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [isPending, session]);

  // Keep the preloader until session + confirmed plan are ready so Thunder vs
  // Free branding/limits appear correctly on first paint (no free→paid flash).
  if (isPending || !session || booting || !planLoaded || !planReady) {
    return <AppPreloader />;
  }

  return <>{children}</>;
}
