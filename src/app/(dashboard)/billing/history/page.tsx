"use client";

import {
  DashboardSuspense,
  SettingsPageFallback,
} from "@/components/drive/DashboardSuspense";
import { BillingHistoryPage } from "@/views/BillingHistoryPage";

export default function Page() {
  return (
    <DashboardSuspense fallback={<SettingsPageFallback />}>
      <BillingHistoryPage />
    </DashboardSuspense>
  );
}
