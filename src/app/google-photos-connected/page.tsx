"use client";

import { Suspense } from "react";
import { AppPreloader } from "@/components/AppPreloader";
import { GooglePhotosConnectedPage } from "@/views/GooglePhotosConnectedPage";

export default function Page() {
  return (
    <Suspense fallback={<AppPreloader label="Connecting Google Photos" />}>
      <GooglePhotosConnectedPage />
    </Suspense>
  );
}
