"use client";

import { Suspense } from "react";
import { AllFilesPage } from "@/views/AllFilesPage";

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="p-8 text-sm text-muted">Loading files...</main>
      }
    >
      <AllFilesPage />
    </Suspense>
  );
}
