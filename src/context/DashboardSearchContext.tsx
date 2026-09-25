"use client";

import { createContext, type ReactNode, useContext } from "react";
import type { DashboardSearchFieldProps } from "@/components/dashboard/DashboardSearchField";

type DashboardSearchContextValue = Omit<
  DashboardSearchFieldProps,
  "autoFocus" | "inputRef" | "className"
>;

const DashboardSearchContext = createContext<
  DashboardSearchContextValue | undefined
>(undefined);

export function DashboardSearchProvider({
  value,
  children,
}: {
  value: DashboardSearchContextValue;
  children: ReactNode;
}) {
  return (
    <DashboardSearchContext.Provider value={value}>
      {children}
    </DashboardSearchContext.Provider>
  );
}

export function useDashboardSearch() {
  return useContext(DashboardSearchContext);
}
