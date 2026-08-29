"use client";

import { Suspense } from "react";
import { DropboxConnectedPage } from "@/views/DropboxConnectedPage";

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-sm text-muted">
          Connecting Dropbox…
        </main>
      }
    >
      <DropboxConnectedPage />
    </Suspense>
  );
}
