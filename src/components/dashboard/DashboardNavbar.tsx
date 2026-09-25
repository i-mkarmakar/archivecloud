"use client";

import { Bars, Magnifier, Xmark } from "@gravity-ui/icons";
import { Button, Header, SearchField, Surface } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { dashboardContentClassName } from "@/components/dashboard/config";
import { RotatingSearchPlaceholder } from "@/components/dashboard/RotatingSearchPlaceholder";
import { BrandLogo } from "@/components/drive/BrandLogo";
import { UpgradePlanModal } from "@/components/drive/UpgradePlanModal";
import { useUserPlan } from "@/hooks/useUserPlan";
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

type Tag = {
  id: string;
  name: string;
  color: string;
};

export function DashboardNavbar({
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
  onOpenSidebar,
  showDesktopBrand = false,
}: {
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
  onOpenSidebar: () => void;
  showDesktopBrand?: boolean;
}) {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const { planId, canUpgrade, loaded: planLoaded, hasThunder } = useUserPlan();

  const upgradeButton = (
    <Button
      variant="primary"
      className="shrink-0 gap-1.5"
      onPress={() => setUpgradeOpen(true)}
    >
      <img
        src="/assets/Thunder.gif"
        alt=""
        aria-hidden
        className="h-5 w-5 object-contain"
      />
      Upgrade
    </Button>
  );

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
                <div className="flex items-center gap-3">
                  {planLoaded && canUpgrade ? upgradeButton : null}
                  <Button
                    variant="outline"
                    isIconOnly
                    size="sm"
                    aria-label="Open search"
                    onPress={() => setMobileSearchOpen(true)}
                  >
                    <Magnifier className="h-5 w-5" />
                  </Button>
                  <SystemInfoPopover />
                </div>
              </div>
            )}
          </div>

          <div className="hidden lg:grid lg:grid-cols-[1fr_minmax(0,28rem)_1fr] lg:items-center lg:gap-4">
            <div className="flex min-w-0 items-center justify-start">
              {showDesktopBrand ? (
                <div className="flex items-center gap-2.5">
                  {planLoaded ? (
                    <BrandLogo
                      className="h-8 w-8 shrink-0"
                      thunder={hasThunder}
                    />
                  ) : (
                    <span
                      className="inline-block h-8 w-8 shrink-0"
                      aria-hidden
                    />
                  )}
                  <span className="text-lg font-extrabold tracking-tight text-foreground">
                    Archive Cloud
                  </span>
                </div>
              ) : null}
            </div>
            {searchField()}
            <div className="hidden items-center justify-end gap-4 lg:flex">
              {planLoaded && canUpgrade ? upgradeButton : null}
              <SystemInfoPopover />
            </div>
          </div>
        </div>
      </Header>
      {planLoaded && canUpgrade ? (
        <UpgradePlanModal
          open={upgradeOpen}
          onClose={() => setUpgradeOpen(false)}
          currentPlanId={planId}
        />
      ) : null}
    </Surface>
  );
}
