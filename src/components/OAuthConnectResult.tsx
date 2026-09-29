"use client";

import { Card } from "@heroui/react";
import { CircleXmark } from "@gravity-ui/icons";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/** OAuth popup callback: notify opener and close. Success shows nothing. */
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
    window.opener?.postMessage(
      { type: messageType, status, ...(accountId ? { accountId } : {}) },
      window.location.origin,
    );
    if (window.opener) {
      window.close();
      return;
    }
    router.replace("/settings");
  }, [accountId, messageType, router, status]);

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
