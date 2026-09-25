"use client";

import { Suspense } from "react";
import { AppPreloader } from "@/components/AppPreloader";
import { PCloudConnectedPage } from "@/views/PCloudConnectedPage";

export default function Page() {
  return (
    <Suspense fallback={<AppPreloader label="Connecting pCloud" />}>
      <PCloudConnectedPage />
    </Suspense>
  );
}
