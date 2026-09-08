"use client";

import {
  DashboardSuspense,
  SettingsPageFallback,
} from "@/components/drive/DashboardSuspense";
import { SettingsPage } from "@/views/SettingsPage";

export default function Page() {
  return (
    <DashboardSuspense fallback={<SettingsPageFallback />}>
      <SettingsPage />
    </DashboardSuspense>
  );
}
