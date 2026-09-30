"use client";

import { CircleXmark } from "@gravity-ui/icons";
import { Card } from "@heroui/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { publishOAuthConnectResult } from "@/lib/oauth-connect";

/** OAuth callback page: notify opener (popup) or return to the app (full-page). */
export function OAuthConnectResult({
  messageType,
  errorDetail,
}: {
  messageType: string;
  errorDetail: (reason: string | null) => string;
}) {
  const sp = useSearchParams() ?? new URLSearchParams();
  const router = useRouter();
  const status = sp.get("status") ?? "success";
  const reason = sp.get("reason");
  const accountId = sp.get("accountId");
  const ok = status === "success";

  useEffect(() => {
    publishOAuthConnectResult({
      type: messageType,
      status,
      accountId,
    });
    if (window.opener) {
      window.close();
      window.setTimeout(() => {
        if (!window.closed) router.replace("/home");
      }, 250);
      return;
    }
    router.replace(ok ? "/home" : "/settings");
  }, [accountId, messageType, ok, router, status]);

  if (ok) return null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background-secondary p-5">
      <Card className="w-full max-w-sm p-6 text-center">
        <CircleXmark className="mx-auto h-10 w-10 text-danger" />
        <h1 className="mt-4 text-xl font-extrabold">Connection Failed</h1>
        <p className="mt-2 text-sm text-muted">{errorDetail(reason)}</p>
      </Card>
    </main>
  );
}
