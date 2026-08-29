"use client";

import { Card } from "@heroui/react";
import { CircleXmark, Cloud } from "@gravity-ui/icons";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function OneDriveConnectedPage() {
  const sp = useSearchParams() ?? new URLSearchParams();
  const router = useRouter();
  const status = sp.get("status") ?? "success";
  const reason = sp.get("reason");
  const ok = status === "success";

  const errorDetail =
    reason === "auth_required"
      ? "Sign in to Archive Cloud, then connect OneDrive again."
      : reason === "session_mismatch"
        ? "This connect link belongs to a different account. Start connect from Settings while signed in."
        : "Close this window and try again.";

  useEffect(() => {
    window.opener?.postMessage(
      { type: "ONEDRIVE_CONNECTED", status },
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
          <Cloud className="mx-auto h-10 w-10 text-accent" />
        ) : (
          <CircleXmark className="mx-auto h-10 w-10 text-danger" />
        )}
        <h1 className="mt-4 text-xl font-extrabold">
          {ok ? "OneDrive Connected" : "Connection Failed"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {ok ? "This window will close automatically." : errorDetail}
        </p>
      </Card>
    </main>
  );
}
