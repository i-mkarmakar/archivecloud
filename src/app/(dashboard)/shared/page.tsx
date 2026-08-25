"use client";

import {
  DashboardSuspense,
  SharedPageFallback,
} from "@/components/drive/DashboardSuspense";
import { SharedPage } from "@/views/SharedPage";

export default function Page() {
  return (
    <DashboardSuspense fallback={<SharedPageFallback />}>
      <SharedPage />
    </DashboardSuspense>
  );
}
