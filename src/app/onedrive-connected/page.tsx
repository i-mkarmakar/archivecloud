"use client";

import { Suspense } from "react";
import { OneDriveConnectedPage } from "@/views/OneDriveConnectedPage";

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-sm text-muted">
          Connecting OneDrive…
        </main>
      }
    >
      <OneDriveConnectedPage />
    </Suspense>
  );
}
