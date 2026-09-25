"use client";

import { Suspense } from "react";
import { AppPreloader } from "@/components/AppPreloader";
import { DropboxConnectedPage } from "@/views/DropboxConnectedPage";

export default function Page() {
  return (
    <Suspense fallback={<AppPreloader label="Connecting Dropbox" />}>
      <DropboxConnectedPage />
    </Suspense>
  );
}
