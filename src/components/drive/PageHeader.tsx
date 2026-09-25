"use client";

import { Heading, Paragraph } from "@heroui/react";
import type { ReactNode } from "react";
import { DashboardSearchField } from "@/components/dashboard/DashboardSearchField";
import { useDashboardSearch } from "@/context/DashboardSearchContext";

export function PageHeader({
  title,
  description,
  titleActions,
  actions,
  mobileSearchEnd,
}: {
  title: ReactNode;
  description?: string;
  titleActions?: ReactNode;
  actions?: ReactNode;
  /** Shown to the right of the mobile search field (below `lg`). */
  mobileSearchEnd?: ReactNode;
}) {
  const dashboardSearch = useDashboardSearch();

  return (
    <div className="mt-1.5 flex flex-col gap-y-3.5 sm:mt-3.5 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-x-3 sm:gap-y-2.5">
      <div className="flex min-w-0 flex-col gap-6 sm:flex-1 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0">
            <Heading
              level={1}
              className="truncate text-left text-xl font-extrabold tracking-tight sm:text-[22px] lg:text-[28px]"
            >
              {title}
            </Heading>
            {description ? (
              <Paragraph className="mt-1 max-w-xl text-xs leading-relaxed text-muted sm:text-sm">
                {description}
              </Paragraph>
            ) : null}
          </div>
          {titleActions ? (
            <div className="flex shrink-0 items-center gap-2">
              {titleActions}
            </div>
          ) : null}
        </div>
        {dashboardSearch ? (
          <div className="mt-1.5 flex w-full min-w-0 items-center gap-1.5 sm:mt-0 sm:gap-2 lg:hidden">
            <div className="min-w-0 flex-1">
              <DashboardSearchField {...dashboardSearch} />
            </div>
            {mobileSearchEnd}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="mt-0.5 flex w-full min-w-0 items-center justify-start sm:mt-0 sm:w-auto sm:flex-initial sm:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
