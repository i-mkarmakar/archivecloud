"use client";

import { Bars } from "@gravity-ui/icons";
import { Button, Surface } from "@heroui/react";
import { useState } from "react";
import { DashboardSearchField } from "@/components/dashboard/DashboardSearchField";
import { BrandLogo } from "@/components/drive/BrandLogo";
import { UpgradePlanModal } from "@/components/drive/UpgradePlanModal";
import { useUserPlan } from "@/hooks/useUserPlan";
import { cn } from "@/lib/utils";
import { SystemInfoPopover } from "./SystemInfoPopover";

/** Full-width navbar chrome — do not use mobile content max-width. */
const navbarContentClassName = "mx-auto w-full max-w-6xl";

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
  forceDesktop = false,
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
  /** Use desktop chrome even below the lg breakpoint (e.g. scaled marketing preview). */
  forceDesktop?: boolean;
}) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const { planId, canUpgrade, loaded: planLoaded, hasThunder } = useUserPlan();

  const searchProps = {
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
  };

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

  return (
    <Surface
      variant="default"
      className="sticky top-0 z-30 border-b border-separator bg-surface/95 backdrop-blur-md"
    >
      <div className="w-full px-3 py-2.5 sm:px-6 sm:py-3 lg:px-8">
        <div
          className={cn(
            navbarContentClassName,
            forceDesktop
              ? "grid grid-cols-[1fr_minmax(0,28rem)_1fr] items-center gap-4"
              : "flex items-center justify-between gap-2 sm:gap-3 lg:grid lg:grid-cols-[1fr_minmax(0,28rem)_1fr] lg:gap-4",
          )}
        >
          <div className="flex min-w-0 items-center justify-start">
            {forceDesktop ? null : (
              <Button
                variant="outline"
                isIconOnly
                size="sm"
                className="size-9 shrink-0 lg:hidden"
                aria-label="Open sidebar"
                onPress={onOpenSidebar}
              >
                <Bars className="h-5 w-5" />
              </Button>
            )}
            {showDesktopBrand ? (
              <div
                className={cn(
                  "items-center gap-2.5",
                  forceDesktop ? "flex" : "hidden lg:flex",
                )}
              >
                <BrandLogo
                  className="h-8 w-8 shrink-0"
                  thunder={planLoaded && hasThunder}
                />
                <span className="text-lg font-extrabold tracking-tight text-foreground">
                  Archive Cloud
                </span>
              </div>
            ) : null}
          </div>

          <div className={cn(forceDesktop ? "block" : "hidden lg:block")}>
            <DashboardSearchField {...searchProps} />
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 sm:gap-3 lg:gap-4">
            {planLoaded && canUpgrade ? upgradeButton : null}
            <SystemInfoPopover />
          </div>
        </div>
      </div>
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
