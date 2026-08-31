"use client";

import { Suspense } from "react";
import { ProfilePage } from "@/views/ProfilePage";

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="p-8 text-sm text-muted">Loading profile...</main>
      }
    >
      <ProfilePage />
    </Suspense>
  );
}
