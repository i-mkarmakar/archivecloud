"use client";

import { Suspense } from "react";
import { PCloudConnectedPage } from "@/views/PCloudConnectedPage";

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-sm text-muted">
          Connecting pCloud…
        </main>
      }
    >
      <PCloudConnectedPage />
    </Suspense>
  );
}
