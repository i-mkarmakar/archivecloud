"use client";

import { useSearchParams } from "next/navigation";
import { FolderSyncView } from "@/views/automation/FolderSyncView";
import { ScheduleTasksView } from "@/views/automation/ScheduleTasksView";

export function AutomationPage() {
  const searchParams = useSearchParams();
  const view = searchParams.get("view");

  if (view === "sync") {
    return <FolderSyncView />;
  }

  return <ScheduleTasksView />;
}
