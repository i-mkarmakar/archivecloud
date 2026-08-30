"use client";

import { Suspense } from "react";
import { GoogleSharedConnectedPage } from "@/views/GoogleSharedConnectedPage";

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-sm text-muted">
          Connecting Shared Drives…
        </main>
      }
    >
      <GoogleSharedConnectedPage />
    </Suspense>
  );
}
