"use client";

import { SearchField } from "@heroui/react";
import { RotatingSearchPlaceholder } from "@/components/dashboard/RotatingSearchPlaceholder";
import { SearchFiltersPopover } from "./SearchFiltersPopover";

const SEARCH_ROTATION_TERMS = ["Photos", "Videos", "Documents"] as const;

type ConnectedAccount = {
  id: string;
  email: string;
  provider: string;
  status: string;
};

type Tag = {
  id: string;
  name: string;
  color: string;
};

export type DashboardSearchFieldProps = {
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  onSearchSubmit: () => void;
  accounts: ConnectedAccount[];
  filterKind: string;
  filterAccountId: string;
  tags: Tag[];
  filterTagId: string;
  filterMinSize: string;
  filterMaxSize: string;
  filterStartDate: string;
  filterEndDate: string;
  onFilterKindChange: (value: string) => void;
  onFilterAccountIdChange: (value: string) => void;
  onFilterTagIdChange: (value: string) => void;
  onFilterMinSizeChange: (value: string) => void;
  onFilterMaxSizeChange: (value: string) => void;
  onFilterStartDateChange: (value: string) => void;
  onFilterEndDateChange: (value: string) => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
  autoFocus?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  className?: string;
};

export function DashboardSearchField({
  searchValue,
  onSearchValueChange,
  onSearchSubmit,
  accounts,
  filterKind,
  filterAccountId,
  tags,
  filterTagId,
  filterMinSize,
  filterMaxSize,
  filterStartDate,
  filterEndDate,
  onFilterKindChange,
  onFilterAccountIdChange,
  onFilterTagIdChange,
  onFilterMinSizeChange,
  onFilterMaxSizeChange,
  onFilterStartDateChange,
  onFilterEndDateChange,
  onApplyFilters,
  onClearFilters,
  autoFocus = false,
  inputRef,
  className,
}: DashboardSearchFieldProps) {
  return (
    <SearchField
      fullWidth
      value={searchValue}
      onChange={onSearchValueChange}
      onSubmit={onSearchSubmit}
      className={className ?? "w-full min-w-0"}
      aria-label="Search files"
    >
      <SearchField.Group>
        <SearchField.SearchIcon />
        <SearchField.Input
          ref={inputRef}
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
          tags={tags}
          filterTagId={filterTagId}
          filterMinSize={filterMinSize}
          filterMaxSize={filterMaxSize}
          filterStartDate={filterStartDate}
          filterEndDate={filterEndDate}
          onFilterKindChange={onFilterKindChange}
          onFilterAccountIdChange={onFilterAccountIdChange}
          onFilterTagIdChange={onFilterTagIdChange}
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
}
