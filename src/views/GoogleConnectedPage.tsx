"use client";
import { Card } from "@heroui/react";
import { CircleCheck, CircleXmark } from "@gravity-ui/icons";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function GoogleConnectedPage() {
  const sp = useSearchParams() ?? new URLSearchParams();
  const router = useRouter();
  const status = sp.get("status") ?? "success";
  const ok = status === "success";

  useEffect(() => {
    window.opener?.postMessage(
      { type: "GOOGLE_CONNECTED", status },
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
          <CircleCheck className="mx-auto h-10 w-10 text-muted" />
        ) : (
          <CircleXmark className="mx-auto h-10 w-10 text-danger" />
        )}
        <h1 className="mt-4 text-xl font-extrabold">
          {ok ? "Google Drive Connected" : "Connection Failed"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {ok
            ? "This window will close automatically."
            : "Close this window and try again."}
        </p>
      </Card>
    </main>
  );
}
