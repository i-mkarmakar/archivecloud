"use client";

import { Suspense } from "react";
import { AppPreloader } from "@/components/AppPreloader";
import { GoogleConnectedPage } from "@/views/GoogleConnectedPage";

export default function Page() {
  return (
    <Suspense fallback={<AppPreloader label="Connecting Google Drive" />}>
      <GoogleConnectedPage />
    </Suspense>
  );
}
