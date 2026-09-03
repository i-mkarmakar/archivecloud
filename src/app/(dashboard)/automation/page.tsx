"use client";

import {
  AutomationPageFallback,
  DashboardSuspense,
} from "@/components/drive/DashboardSuspense";
import { AutomationPage } from "@/views/AutomationPage";

export default function Page() {
  return (
    <DashboardSuspense fallback={<AutomationPageFallback />}>
      <AutomationPage />
    </DashboardSuspense>
  );
}
