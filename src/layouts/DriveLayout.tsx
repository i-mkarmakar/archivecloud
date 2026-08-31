"use client";

import { Drawer, useOverlayState } from "@heroui/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { DashboardNavbar } from "@/components/dashboard/DashboardNavbar";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { dashboardContentClassName } from "@/components/dashboard/config";
import { UploadProgressPanel } from "@/components/dashboard/UploadProgressPanel";
import { useUpload } from "@/context/UploadContext";
import { apiFetch } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { type AuthUser, sessionUserToAuthUser } from "@/lib/auth-user";

type StorageSummary = {
  totalBytes: string | null;
  usedBytes: string;
  availableBytes: string | null;
};

type StorageBreakdown = {
  photo: string;
  video: string;
  document: string;
  other: string;
};

type ConnectedAccount = {
  id: string;
  email: string;
  provider: string;
  status: string;
};

export type DriveLayoutContext = {
  setHeaderActions: (actions: ReactNode) => void;
};

const DriveLayoutContext = createContext<DriveLayoutContext | null>(null);

export function useDriveLayoutActions() {
  const context = useContext(DriveLayoutContext);
  if (!context)
    throw new Error("useDriveLayoutActions must be used within DriveLayout");
  return context;
}

export function DriveLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const safePathname = usePathname() ?? "";
  const sp = useSearchParams() ?? new URLSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarDrawer = useOverlayState({
    isOpen: sidebarOpen,
    onOpenChange: setSidebarOpen,
  });
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
  const [breakdown, setBreakdown] = useState<StorageBreakdown>({
    photo: "0",
    video: "0",
    document: "0",
    other: "0",
  });
  const [headerActions, setHeaderActions] = useState<ReactNode>(null);
  const { uploadProgress, setUploadProgress, retryFailedUpload } = useUpload();
  const [uploadProgressCollapsed, setUploadProgressCollapsed] = useState(false);

  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [filterKind, setFilterKind] = useState(sp.get("kind") ?? "");
  const [filterAccountId, setFilterAccountId] = useState(
    sp.get("accountId") ?? "",
  );
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

  async function loadSidebarStats() {
    const [summary, breakdownData] = await Promise.all([
      apiFetch<StorageSummary>("/storage/summary"),
      apiFetch<StorageBreakdown>("/storage/breakdown"),
    ]);
    setStorage(summary);
    setBreakdown(breakdownData);
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

  useEffect(() => {
    setSearchValue(sp.get("q") ?? "");
    setFilterKind(sp.get("kind") ?? "");
    setFilterAccountId(sp.get("accountId") ?? "");
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
    await authClient.signOut();
    router.replace("/signin");
  }

  function applyFilters() {
    const nextParams = new URLSearchParams();
    const activeFolderId = sp.get("folderId");
    if (activeFolderId && safePathname === "/all-files") {
      nextParams.set("folderId", activeFolderId);
    }

    const q = searchValue.trim();
    if (q) nextParams.set("q", q);
    if (filterKind) nextParams.set("kind", filterKind);
    if (filterAccountId) nextParams.set("accountId", filterAccountId);

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
    router.push(qs ? `/all-files?${qs}` : "/all-files");
  }

  function clearFilters() {
    setFilterKind("");
    setFilterAccountId("");
    setFilterMinSize("");
    setFilterMaxSize("");
    setFilterStartDate("");
    setFilterEndDate("");

    const nextParams = new URLSearchParams();
    const activeFolderId = sp.get("folderId");
    if (activeFolderId && safePathname === "/all-files") {
      nextParams.set("folderId", activeFolderId);
    }
    const q = searchValue.trim();
    if (q) nextParams.set("q", q);

    const qs = nextParams.toString();
    router.push(qs ? `/all-files?${qs}` : "/all-files");
  }

  useEffect(() => {
    if (sessionPending || !session?.user) return;
    loadSidebarStats().catch(() => undefined);
    loadConnectedAccounts().catch(() => undefined);
    window.addEventListener("archivecloud:storage-changed", loadSidebarStats);
    return () =>
      window.removeEventListener(
        "archivecloud:storage-changed",
        loadSidebarStats,
      );
  }, [sessionPending, session?.user]);

  const sidebarProps = {
    safePathname,
    user,
    storage,
    breakdown,
    onLogout: logout,
  };

  return (
    <div className="flex min-h-svh w-full bg-background text-foreground">
      <div className="hidden lg:flex lg:h-svh lg:shrink-0">
        <DashboardSidebar {...sidebarProps} />
      </div>

      <Drawer state={sidebarDrawer}>
        <Drawer.Backdrop isDismissable className="lg:hidden">
          <Drawer.Content
            placement="left"
            className="lg:hidden max-w-[16rem] p-0"
          >
            <Drawer.Dialog className="h-full max-w-none p-0">
              <DashboardSidebar
                {...sidebarProps}
                onNavigate={() => setSidebarOpen(false)}
                className="h-full border-r-0"
              />
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>

      <div className="flex min-w-0 flex-1 flex-col lg:h-svh">
        <DashboardNavbar
          searchValue={searchValue}
          onSearchValueChange={setSearchValue}
          onSearchSubmit={applyFilters}
          accounts={accounts}
          filterKind={filterKind}
          filterAccountId={filterAccountId}
          filterMinSize={filterMinSize}
          filterMaxSize={filterMaxSize}
          filterStartDate={filterStartDate}
          filterEndDate={filterEndDate}
          onFilterKindChange={setFilterKind}
          onFilterAccountIdChange={setFilterAccountId}
          onFilterMinSizeChange={setFilterMinSize}
          onFilterMaxSizeChange={setFilterMaxSize}
          onFilterStartDateChange={setFilterStartDate}
          onFilterEndDateChange={setFilterEndDate}
          onApplyFilters={applyFilters}
          onClearFilters={clearFilters}
          headerActions={headerActions}
          onOpenSidebar={() => setSidebarOpen(true)}
        />

        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className={dashboardContentClassName}>
            <DriveLayoutContext.Provider value={{ setHeaderActions }}>
              {children}
            </DriveLayoutContext.Provider>
          </div>
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
    </div>
  );
}
