"use client";

import {
  DashboardSuspense,
  SearchPageFallback,
} from "@/components/drive/DashboardSuspense";
import { SearchPage } from "@/views/SearchPage";

export default function Page() {
  return (
    <DashboardSuspense fallback={<SearchPageFallback />}>
      <SearchPage />
    </DashboardSuspense>
  );
}
