"use client";

import { Bars } from "@gravity-ui/icons";
import { Button, Header, Surface } from "@heroui/react";
import { useState } from "react";
import { dashboardContentClassName } from "@/components/dashboard/config";
import { DashboardSearchField } from "@/components/dashboard/DashboardSearchField";
import { BrandLogo } from "@/components/drive/BrandLogo";
import { UpgradePlanModal } from "@/components/drive/UpgradePlanModal";
import { useUserPlan } from "@/hooks/useUserPlan";
import { cn } from "@/lib/utils";
import { SystemInfoPopover } from "./SystemInfoPopover";

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
      <Header className="px-3 py-2.5 sm:px-6 sm:py-3 lg:px-8">
        <div className={cn(dashboardContentClassName, "flex flex-col gap-3")}>
          {forceDesktop ? null : (
            <div className="flex items-center justify-between gap-2 sm:gap-3 lg:hidden">
              <Button
                variant="outline"
                isIconOnly
                size="sm"
                aria-label="Open sidebar"
                onPress={onOpenSidebar}
              >
                <Bars className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2 sm:gap-3">
                {planLoaded && canUpgrade ? upgradeButton : null}
                <SystemInfoPopover />
              </div>
            </div>
          )}

          <div
            className={cn(
              forceDesktop
                ? "grid grid-cols-[1fr_minmax(0,28rem)_1fr] items-center gap-4"
                : "hidden lg:grid lg:grid-cols-[1fr_minmax(0,28rem)_1fr] lg:items-center lg:gap-4",
            )}
          >
            <div className="flex min-w-0 items-center justify-start">
              {showDesktopBrand ? (
                <div className="flex items-center gap-2.5">
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
            <DashboardSearchField {...searchProps} />
            <div
              className={cn(
                "items-center justify-end gap-4",
                forceDesktop ? "flex" : "hidden lg:flex",
              )}
            >
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
