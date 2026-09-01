"use client";

import { Button, Header, SearchField, Surface } from "@heroui/react";
import { Bars, Magnifier, Xmark } from "@gravity-ui/icons";
import { useEffect, useRef, useState } from "react";
import { dashboardContentClassName } from "@/components/dashboard/config";
import { RotatingSearchPlaceholder } from "@/components/dashboard/RotatingSearchPlaceholder";
import { cn } from "@/lib/utils";
import { SearchFiltersPopover } from "./SearchFiltersPopover";
import { SystemInfoPopover } from "./SystemInfoPopover";

const SEARCH_ROTATION_TERMS = ["Photos", "Videos", "Documents"] as const;

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
  onOpenSidebar: () => void;
}) {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!mobileSearchOpen) return;
    mobileSearchInputRef.current?.focus();
  }, [mobileSearchOpen]);

  const searchField = (autoFocus = false) => (
    <SearchField
      fullWidth
      value={searchValue}
      onChange={onSearchValueChange}
      onSubmit={() => {
        onSearchSubmit();
        setMobileSearchOpen(false);
      }}
      className="w-full min-w-0"
      aria-label="Search files"
    >
      <SearchField.Group>
        <SearchField.SearchIcon />
        <SearchField.Input
          ref={mobileSearchOpen ? mobileSearchInputRef : undefined}
          autoFocus={autoFocus}
          placeholder=" "
          className="flex-1 bg-transparent"
        />
        {!searchValue ? (
          <RotatingSearchPlaceholder terms={SEARCH_ROTATION_TERMS} />
        ) : null}
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
  );

  return (
    <Surface
      variant="default"
      className="sticky top-0 z-30 border-b border-separator bg-surface/95 backdrop-blur-md"
    >
      <Header className="px-4 py-3 sm:px-6 lg:px-8">
        <div className={cn(dashboardContentClassName, "flex flex-col gap-3")}>
          <div className="lg:hidden">
            {mobileSearchOpen ? (
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">{searchField(true)}</div>
                <Button
                  variant="outline"
                  isIconOnly
                  size="sm"
                  aria-label="Close search"
                  onPress={() => setMobileSearchOpen(false)}
                >
                  <Xmark className="h-5 w-5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  isIconOnly
                  size="sm"
                  aria-label="Open sidebar"
                  onPress={onOpenSidebar}
                >
                  <Bars className="h-5 w-5" />
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    isIconOnly
                    size="sm"
                    aria-label="Open search"
                    onPress={() => setMobileSearchOpen(true)}
                  >
                    <Magnifier className="h-5 w-5" />
                  </Button>
                  <SystemInfoPopover accounts={accounts} />
                </div>
              </div>
            )}
          </div>

          <div className="hidden lg:grid lg:grid-cols-[1fr_minmax(0,28rem)_1fr] lg:items-center lg:gap-4">
            <div className="hidden min-w-0 lg:block" aria-hidden="true" />
            {searchField()}
            <div className="hidden items-center justify-end lg:flex">
              <SystemInfoPopover accounts={accounts} />
            </div>
          </div>
        </div>
      </Header>
    </Surface>
  );
}
