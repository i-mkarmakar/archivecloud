"use client";

import { Suspense } from "react";
import { AppPreloader } from "@/components/AppPreloader";
import { GoogleSharedConnectedPage } from "@/views/GoogleSharedConnectedPage";

export default function Page() {
  return (
    <Suspense fallback={<AppPreloader label="Connecting Shared Drives" />}>
      <GoogleSharedConnectedPage />
    </Suspense>
  );
}
