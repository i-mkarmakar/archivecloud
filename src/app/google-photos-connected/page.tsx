"use client";

import { Suspense } from "react";
import { GooglePhotosConnectedPage } from "@/views/GooglePhotosConnectedPage";

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-sm text-muted">
          Connecting Google Photos…
        </main>
      }
    >
      <GooglePhotosConnectedPage />
    </Suspense>
  );
}
