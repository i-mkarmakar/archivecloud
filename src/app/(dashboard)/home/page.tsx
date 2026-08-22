"use client";

import {
  DashboardSuspense,
  FilesPageFallback,
} from "@/components/drive/DashboardSuspense";
import { AllFilesPage } from "@/views/AllFilesPage";

export default function Page() {
  return (
    <DashboardSuspense fallback={<FilesPageFallback />}>
      <AllFilesPage />
    </DashboardSuspense>
  );
}
