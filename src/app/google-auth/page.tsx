"use client";
import { Suspense } from "react";
import { GoogleAuthPage } from "@/views/GoogleAuthPage";
export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center p-5 text-sm text-muted">
          Completing Google sign-in...
        </main>
      }
    >
      <GoogleAuthPage />
    </Suspense>
  );
}
