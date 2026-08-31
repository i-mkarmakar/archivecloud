"use client";

import { Button, Header, SearchField, Surface } from "@heroui/react";
import { Bars } from "@gravity-ui/icons";
import type { ReactNode } from "react";
import { dashboardContentClassName } from "@/components/dashboard/config";
import { BrandLogo } from "@/components/drive/BrandLogo";
import { cn } from "@/lib/utils";
import { SearchFiltersPopover } from "./SearchFiltersPopover";
import { SystemInfoPopover } from "./SystemInfoPopover";

type ConnectedAccount = {
  id: string;
  email: string;
  provider: string;
  status: string;
};

export function DashboardNavbar({
  searchValue,
  onSearchValueChange,
  onSearchSubmit,
  accounts,
  filterKind,
  filterAccountId,
  filterMinSize,
  filterMaxSize,
  filterStartDate,
  filterEndDate,
  onFilterKindChange,
  onFilterAccountIdChange,
  onFilterMinSizeChange,
  onFilterMaxSizeChange,
  onFilterStartDateChange,
  onFilterEndDateChange,
  onApplyFilters,
  onClearFilters,
  headerActions,
  onOpenSidebar,
}: {
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  onSearchSubmit: () => void;
  accounts: ConnectedAccount[];
  filterKind: string;
  filterAccountId: string;
  filterMinSize: string;
  filterMaxSize: string;
  filterStartDate: string;
  filterEndDate: string;
  onFilterKindChange: (value: string) => void;
  onFilterAccountIdChange: (value: string) => void;
  onFilterMinSizeChange: (value: string) => void;
  onFilterMaxSizeChange: (value: string) => void;
  onFilterStartDateChange: (value: string) => void;
  onFilterEndDateChange: (value: string) => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
  headerActions: ReactNode;
  onOpenSidebar: () => void;
}) {
  return (
    <Surface
      variant="default"
      className="sticky top-0 z-30 border-b border-separator bg-surface/95 backdrop-blur-md"
    >
      <Header className="px-4 py-3 sm:px-6 lg:px-8">
        <div
          className={cn(
            dashboardContentClassName,
            "flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between",
          )}
        >
          <div className="flex items-center justify-between gap-3 lg:hidden">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                variant="outline"
                isIconOnly
                size="sm"
                aria-label="Open sidebar"
                onPress={onOpenSidebar}
              >
                <Bars className="h-5 w-5" />
              </Button>
              <div className="flex min-w-0 items-center gap-2">
                <BrandLogo className="h-9 w-9 shrink-0" />
                <span className="truncate text-xl font-extrabold tracking-tight">
                  ArchiveCloud
                </span>
              </div>
            </div>
            <SystemInfoPopover accounts={accounts} />
          </div>

          <SearchField
            fullWidth
            value={searchValue}
            onChange={onSearchValueChange}
            onSubmit={onSearchSubmit}
            className="w-full min-w-0 flex-1 lg:max-w-xs xl:max-w-sm"
            aria-label="Search documents"
          >
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Search Documents" />
              <SearchFiltersPopover
                accounts={accounts}
                filterKind={filterKind}
                filterAccountId={filterAccountId}
                filterMinSize={filterMinSize}
                filterMaxSize={filterMaxSize}
                filterStartDate={filterStartDate}
                filterEndDate={filterEndDate}
                onFilterKindChange={onFilterKindChange}
                onFilterAccountIdChange={onFilterAccountIdChange}
                onFilterMinSizeChange={onFilterMinSizeChange}
                onFilterMaxSizeChange={onFilterMaxSizeChange}
                onFilterStartDateChange={onFilterStartDateChange}
                onFilterEndDateChange={onFilterEndDateChange}
                onApply={onApplyFilters}
                onClear={onClearFilters}
              />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>

          {headerActions ? (
            <div className="hidden items-center gap-2 shrink-0 lg:flex">
              {headerActions}
            </div>
          ) : null}

          <div className="hidden items-center gap-2 shrink-0 lg:flex">
            <SystemInfoPopover accounts={accounts} />
          </div>
        </div>
      </Header>
    </Surface>
  );
}
