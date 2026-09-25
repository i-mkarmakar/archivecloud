"use client";

import { Suspense } from "react";
import { AppPreloader } from "@/components/AppPreloader";
import { OneDriveConnectedPage } from "@/views/OneDriveConnectedPage";

export default function Page() {
  return (
    <Suspense fallback={<AppPreloader label="Connecting OneDrive" />}>
      <OneDriveConnectedPage />
    </Suspense>
  );
}
