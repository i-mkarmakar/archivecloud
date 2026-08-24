"use client";

import {
  CloudsPageFallback,
  DashboardSuspense,
} from "@/components/drive/DashboardSuspense";
import { CloudsPage } from "@/views/CloudsPage";

export default function Page() {
  return (
    <DashboardSuspense fallback={<CloudsPageFallback />}>
      <CloudsPage />
    </DashboardSuspense>
  );
}
