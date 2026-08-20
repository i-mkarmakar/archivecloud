"use client";

import { Suspense } from "react";
import { SettingsPage } from "@/views/SettingsPage";

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="p-8 text-sm text-muted">Loading settings...</main>
      }
    >
      <SettingsPage />
    </Suspense>
  );
}
