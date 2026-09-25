"use client";

import { Drawer, toast, useOverlayState } from "@heroui/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, Suspense, useEffect, useState } from "react";
import { BillingSuccessOverlay } from "@/components/billing/BillingSuccessOverlay";
import { dashboardContentClassName } from "@/components/dashboard/config";
import { DashboardNavbar } from "@/components/dashboard/DashboardNavbar";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { SidebarNewButton } from "@/components/dashboard/SidebarNewButton";
import { UploadProgressPanel } from "@/components/dashboard/UploadProgressPanel";
import { DashboardSearchProvider } from "@/context/DashboardSearchContext";
import { useUpload } from "@/context/UploadContext";
import { resetUserPlanStore } from "@/hooks/useUserPlan";
import { apiFetch } from "@/lib/api";
import { clearAppBoot } from "@/lib/app-boot";
import { authClient } from "@/lib/auth-client";
import { type AuthUser, sessionUserToAuthUser } from "@/lib/auth-user";
import { syncGoogleProfileImageIfNeeded } from "@/lib/sync-google-avatar";
import { clearUserPlanCache } from "@/lib/user-plan-cache";
import { cn } from "@/lib/utils";

type StorageSummary = {
  totalBytes: string | null;
  usedBytes: string;
  availableBytes: string | null;
};

type ConnectedAccount = {
  id: string;
  email: string;
  displayName?: string | null;
  provider: string;
  status: string;
};

export function DriveLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const safePathname = usePathname() ?? "";
  const sp = useSearchParams() ?? new URLSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarDrawer = useOverlayState({
    isOpen: sidebarOpen,
    onOpenChange: setSidebarOpen,
  });
  const [desktopSidebarExpanded, setDesktopSidebarExpanded] = useState(true);
  const [searchValue, setSearchValue] = useState(sp.get("q") ?? "");
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const user: AuthUser | null = session?.user
    ? sessionUserToAuthUser(session.user)
    : null;
  const [storage, setStorage] = useState<StorageSummary>({
    totalBytes: "0",
    usedBytes: "0",
    availableBytes: "0",
  });
  const { uploadProgress, setUploadProgress, retryFailedUpload } = useUpload();
  const [uploadProgressCollapsed, setUploadProgressCollapsed] = useState(false);

  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [tags, setTags] = useState<
    Array<{ id: string; name: string; color: string }>
  >([]);
  const [filterKind, setFilterKind] = useState(sp.get("kind") ?? "");
  const [filterAccountId, setFilterAccountId] = useState(
    sp.get("accountId") ?? "",
  );
  const [filterTagId, setFilterTagId] = useState(sp.get("tagId") ?? "");
  const [filterMinSize, setFilterMinSize] = useState(() => {
    const min = sp.get("minSize");
    return min ? String(Math.round(Number(min) / (1024 * 1024))) : "";
  });
  const [filterMaxSize, setFilterMaxSize] = useState(() => {
    const max = sp.get("maxSize");
    return max ? String(Math.round(Number(max) / (1024 * 1024))) : "";
  });
  const [filterStartDate, setFilterStartDate] = useState(() => {
    const raw = sp.get("startDate");
    return raw ? raw.split("T")[0] : "";
  });
  const [filterEndDate, setFilterEndDate] = useState(() => {
    const raw = sp.get("endDate");
    return raw ? raw.split("T")[0] : "";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("light");
    root.classList.remove("dark");
    root.setAttribute("data-theme", "light");
    localStorage.removeItem("archivecloud:theme");
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("archivecloud:sidebar-expanded");
      if (stored === "0") setDesktopSidebarExpanded(false);
      if (stored === "1") setDesktopSidebarExpanded(true);
    } catch {}
  }, []);

  function setDesktopSidebarExpandedAndPersist(next: boolean) {
    setDesktopSidebarExpanded(next);
    try {
      localStorage.setItem("archivecloud:sidebar-expanded", next ? "1" : "0");
    } catch {}
  }

  useEffect(() => {
    if (sessionPending || !user) return;
    void syncGoogleProfileImageIfNeeded(user.image);
  }, [sessionPending, user?.id, user?.image]);

  useEffect(() => {
    const status = sp.get("googleDrive");
    if (!status) return;
    if (status === "connected") {
      toast.success("Google Drive connected to your account.");
      void loadConnectedAccounts();
      void loadSidebarStats();
    } else if (status === "error") {
      toast.danger(
        "Could not connect Google Drive. You can retry in Settings.",
      );
    }
    const next = new URLSearchParams(sp.toString());
    next.delete("googleDrive");
    const qs = next.toString();
    router.replace(qs ? `${safePathname}?${qs}` : safePathname);
  }, [sp, router, safePathname]);

  async function loadSidebarStats() {
    const summary = await apiFetch<StorageSummary>("/storage/summary");
    setStorage(summary);
  }

  async function loadConnectedAccounts() {
    try {
      const data = await apiFetch<{ accounts: ConnectedAccount[] }>(
        "/connected-accounts",
      );
      setAccounts(data.accounts);
    } catch (e) {
      console.error("Failed to load accounts for filter dropdown", e);
    }
  }

  async function loadTags() {
    try {
      const data = await apiFetch<{
        tags: Array<{ id: string; name: string; color: string }>;
      }>("/tags");
      setTags(data.tags);
    } catch (e) {
      console.error("Failed to load tags for filter dropdown", e);
    }
  }

  useEffect(() => {
    setSearchValue(sp.get("q") ?? "");
    setFilterKind(sp.get("kind") ?? "");
    setFilterAccountId(sp.get("accountId") ?? "");
    setFilterTagId(sp.get("tagId") ?? "");
    setFilterMinSize(() => {
      const min = sp.get("minSize");
      return min ? String(Math.round(Number(min) / (1024 * 1024))) : "";
    });
    setFilterMaxSize(() => {
      const max = sp.get("maxSize");
      return max ? String(Math.round(Number(max) / (1024 * 1024))) : "";
    });
    const rawStart = sp.get("startDate");
    setFilterStartDate(rawStart ? rawStart.split("T")[0] : "");
    const rawEnd = sp.get("endDate");
    setFilterEndDate(rawEnd ? rawEnd.split("T")[0] : "");
  }, [sp]);

  async function logout() {
    clearAppBoot();
    clearUserPlanCache();
    resetUserPlanStore();
    await authClient.signOut();
    // Full navigation clears the client session atom so LoginForm does not
    // treat a stale session as still signed-in and bounce back to /home.
    window.location.assign("/auth/sign-in");
  }

  function applyFilters() {
    const nextParams = new URLSearchParams();
    const activeFolderId = sp.get("folderId");
    if (activeFolderId && safePathname === "/home") {
      nextParams.set("folderId", activeFolderId);
    }

    const q = searchValue.trim();
    if (q) {
      nextParams.set("q", q);
      if (filterAccountId) nextParams.set("accountId", filterAccountId);
      const qs = nextParams.toString();
      router.push(`/search?${qs}`);
      return;
    }
    if (filterKind) nextParams.set("kind", filterKind);
    if (filterAccountId) nextParams.set("accountId", filterAccountId);
    if (filterTagId) nextParams.set("tagId", filterTagId);

    if (filterMinSize) {
      const bytes = Number(filterMinSize) * 1024 * 1024;
      if (!Number.isNaN(bytes)) nextParams.set("minSize", String(bytes));
    }
    if (filterMaxSize) {
      const bytes = Number(filterMaxSize) * 1024 * 1024;
      if (!Number.isNaN(bytes)) nextParams.set("maxSize", String(bytes));
    }
    if (filterStartDate)
      nextParams.set("startDate", new Date(filterStartDate).toISOString());
    if (filterEndDate)
      nextParams.set("endDate", new Date(filterEndDate).toISOString());

    const qs = nextParams.toString();
    router.push(qs ? `/home?${qs}` : "/home");
  }

  function clearFilters() {
    setFilterKind("");
    setFilterAccountId("");
    setFilterTagId("");
    setFilterMinSize("");
    setFilterMaxSize("");
    setFilterStartDate("");
    setFilterEndDate("");

    const nextParams = new URLSearchParams();
    const activeFolderId = sp.get("folderId");
    if (activeFolderId && safePathname === "/home") {
      nextParams.set("folderId", activeFolderId);
    }
    const q = searchValue.trim();
    if (q) nextParams.set("q", q);

    const qs = nextParams.toString();
    router.push(qs ? `/home?${qs}` : "/home");
  }

  useEffect(() => {
    if (sessionPending || !session?.user) return;
    loadSidebarStats().catch(() => undefined);
    loadConnectedAccounts().catch(() => undefined);
    loadTags().catch(() => undefined);
    function onStorageChanged() {
      loadSidebarStats().catch(() => undefined);
      loadConnectedAccounts().catch(() => undefined);
    }
    window.addEventListener("archivecloud:storage-changed", onStorageChanged);
    return () =>
      window.removeEventListener(
        "archivecloud:storage-changed",
        onStorageChanged,
      );
  }, [sessionPending, session?.user]);

  const sidebarProps = {
    safePathname,
    user,
    storage,
    accounts,
    onLogout: logout,
  };

  const searchProps = {
    searchValue,
    onSearchValueChange: setSearchValue,
    onSearchSubmit: applyFilters,
    accounts,
    filterKind,
    filterAccountId,
    tags,
    filterTagId,
    filterMinSize,
    filterMaxSize,
    filterStartDate,
    filterEndDate,
    onFilterKindChange: setFilterKind,
    onFilterAccountIdChange: setFilterAccountId,
    onFilterTagIdChange: setFilterTagId,
    onFilterMinSizeChange: setFilterMinSize,
    onFilterMaxSizeChange: setFilterMaxSize,
    onFilterStartDateChange: setFilterStartDate,
    onFilterEndDateChange: setFilterEndDate,
    onApplyFilters: applyFilters,
    onClearFilters: clearFilters,
  };

  return (
    <DashboardSearchProvider value={searchProps}>
      <div className="drive-app flex min-h-svh w-full bg-background text-foreground">
        <div
          className={cn(
            "relative z-20 hidden h-svh shrink-0 overflow-visible transition-[width] duration-200 ease-out lg:flex",
            desktopSidebarExpanded ? "w-[17rem]" : "w-[4.5rem]",
          )}
        >
          <DashboardSidebar
            {...sidebarProps}
            collapsed={!desktopSidebarExpanded}
            onToggleCollapse={() =>
              setDesktopSidebarExpandedAndPersist(!desktopSidebarExpanded)
            }
          />
        </div>

        <Drawer state={sidebarDrawer}>
          <Drawer.Backdrop isDismissable className="lg:hidden">
            <Drawer.Content placement="left" className="lg:hidden">
              <Drawer.Dialog className="h-full w-[17rem] max-w-[17rem] gap-0 overflow-hidden rounded-none border-0 bg-[#f4f7fa] p-0 shadow-none sm:w-[17rem]">
                <DashboardSidebar
                  {...sidebarProps}
                  onNavigate={() => setSidebarOpen(false)}
                  hideNewButton
                  className="h-full w-full max-w-none border-r-0 bg-[#f4f7fa]"
                />
              </Drawer.Dialog>
            </Drawer.Content>
          </Drawer.Backdrop>
        </Drawer>

        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center lg:hidden">
          <div className="pointer-events-auto">
            <SidebarNewButton
              safePathname={safePathname}
              fab
              disabled={
                accounts.filter((account) => account.status === "connected")
                  .length === 0
              }
            />
          </div>
        </div>

        <div className="relative z-0 flex min-w-0 flex-1 flex-col lg:h-svh">
          <DashboardNavbar
            {...searchProps}
            onOpenSidebar={() => setSidebarOpen(true)}
            showDesktopBrand={false}
          />

          <main className="min-h-0 flex-1 overflow-y-auto px-3 py-3 pb-24 sm:p-6 lg:p-8 lg:pb-8">
            <div className={dashboardContentClassName}>{children}</div>
          </main>
        </div>

        <UploadProgressPanel
          uploadProgress={uploadProgress}
          collapsed={uploadProgressCollapsed}
          onToggleCollapsed={() => setUploadProgressCollapsed((v) => !v)}
          onClose={() =>
            setUploadProgress((current) => ({ ...current, open: false }))
          }
          onRetry={retryFailedUpload}
        />

        <Suspense fallback={null}>
          <BillingSuccessOverlay />
        </Suspense>
      </div>
    </DashboardSearchProvider>
  );
}
