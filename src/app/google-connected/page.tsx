"use client";
import { Suspense } from "react";
import { GoogleConnectedPage } from "@/views/GoogleConnectedPage";
export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center p-5 text-sm text-muted">
          Processing connection...
        </main>
      }
    >
      <GoogleConnectedPage />
    </Suspense>
  );
}
