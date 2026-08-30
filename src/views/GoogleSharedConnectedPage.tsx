"use client";

import { Card } from "@heroui/react";
import { CircleXmark } from "@gravity-ui/icons";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { GoogleDriveLogo } from "@/components/drive/GoogleDriveLogo";

export function GoogleSharedConnectedPage() {
  const sp = useSearchParams() ?? new URLSearchParams();
  const router = useRouter();
  const status = sp.get("status") ?? "success";
  const reason = sp.get("reason");
  const ok = status === "success";

  const errorDetail =
    reason === "auth_required"
      ? "Sign in to Archive Cloud, then connect Google Shared Drive again."
      : reason === "session_mismatch"
        ? "This connect link belongs to a different account. Start connect from Settings while signed in."
        : reason === "no_shared_drives"
          ? "No shared drives were found on this Google account."
          : "Close this window and try again.";

  useEffect(() => {
    window.opener?.postMessage(
      { type: "GOOGLE_SHARED_CONNECTED", status },
      window.location.origin,
    );
    const timer = window.setTimeout(() => {
      if (window.opener) window.close();
      else router.replace("/settings");
    }, 800);
    return () => window.clearTimeout(timer);
  }, [router, status]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background-secondary p-5">
      <Card className="w-full max-w-sm p-6 text-center">
        {ok ? (
          <GoogleDriveLogo className="mx-auto h-10 w-10" />
        ) : (
          <CircleXmark className="mx-auto h-10 w-10 text-danger" />
        )}
        <h1 className="mt-4 text-xl font-extrabold">
          {ok ? "Shared Drives Connected" : "Connection Failed"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {ok ? "This window will close automatically." : errorDetail}
        </p>
      </Card>
    </main>
  );
}
