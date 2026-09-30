"use client";

import {
  ArrowRotateRight,
  ChevronsExpandVertical,
  Sliders,
} from "@gravity-ui/icons";
import { Button } from "@heroui/react";
import { Suspense, useState } from "react";
import { dashboardContentClassName } from "@/components/dashboard/config";
import { DashboardNavbar } from "@/components/dashboard/DashboardNavbar";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DriveSection } from "@/components/drive/DriveSection";
import { FileGrid } from "@/components/drive/FileGrid";
import {
  FileViewToggle,
  type FileViewMode,
} from "@/components/drive/FileViewToggle";
import { FolderGrid } from "@/components/drive/FolderGrid";
import { PageHeader } from "@/components/drive/PageHeader";
import { defaultFolderColor } from "@/components/drive/folder-colors";
import { DashboardSearchProvider } from "@/context/DashboardSearchContext";
import type { FileItem, FolderItem } from "@/data/drive-data";
import type { AuthUser } from "@/lib/auth-user";
import { getFirstName, getTimeGreeting } from "@/lib/greeting";
import { cn } from "@/lib/utils";

const DEMO_USER: AuthUser = {
  id: "hero-demo-user",
  name: "Chris Walker",
  email: "chris.walker@example.com",
  image: null,
};

const DEMO_ACCOUNT = {
  id: "hero-demo-gdrive",
  email: "chris.walker@example.com",
  displayName: "My Google Drive",
  provider: "google_drive",
  status: "connected",
  storageAccount: { usedBytes: "13500000000" },
};

const DEMO_FOLDERS: FolderItem[] = [
  {
    id: "f1",
    name: "Campaign Assets",
    updated: "Updated Sep 5, 2026, 2:14 PM",
    color: defaultFolderColor,
    accountProvider: "google_drive",
    accountEmail: DEMO_ACCOUNT.email,
  },
  {
    id: "f2",
    name: "Presentation Decks",
    updated: "Updated Sep 4, 2026, 11:02 AM",
    color: "#1e1e1e",
    accountProvider: "google_drive",
    accountEmail: DEMO_ACCOUNT.email,
  },
  {
    id: "f3",
    name: "Brand Guidelines",
    updated: "Updated Sep 3, 2026, 4:40 PM",
    color: "#ffffff",
    accountProvider: "google_drive",
    accountEmail: DEMO_ACCOUNT.email,
  },
  {
    id: "f4",
    name: "Product Shots",
    updated: "Updated Sep 2, 2026, 9:18 AM",
    color: defaultFolderColor,
    accountProvider: "google_drive",
    accountEmail: DEMO_ACCOUNT.email,
  },
  {
    id: "f5",
    name: "Finance",
    updated: "Updated Aug 28, 2026, 3:05 PM",
    color: "#1e1e1e",
    accountProvider: "google_drive",
    accountEmail: DEMO_ACCOUNT.email,
  },
  {
    id: "f6",
    name: "Videos",
    updated: "Updated Aug 22, 2026, 1:44 PM",
    color: defaultFolderColor,
    accountProvider: "google_drive",
    accountEmail: DEMO_ACCOUNT.email,
  },
  {
    id: "f7",
    name: "Client References",
    updated: "Updated Aug 18, 2026, 10:21 AM",
    color: "#ffffff",
    accountProvider: "google_drive",
    accountEmail: DEMO_ACCOUNT.email,
  },
  {
    id: "f8",
    name: "New Folder",
    updated: "Updated Aug 12, 2026, 5:56 PM",
    color: defaultFolderColor,
    accountProvider: "google_drive",
    accountEmail: DEMO_ACCOUNT.email,
  },
];

const DEMO_FILES: FileItem[] = [
  {
    id: "file-1",
    name: "Q3 Brand Deck.pdf",
    mimeType: "application/pdf",
    date: "Sep 5, 2026",
    size: "2.4 MB",
    sizeBytes: "2516582",
    access: DEMO_ACCOUNT.email,
    accountEmail: DEMO_ACCOUNT.email,
    accountProvider: "Google Drive",
    kind: "pdf",
    shared: 1,
  },
  {
    id: "file-2",
    name: "hero-banner.png",
    mimeType: "image/png",
    date: "Sep 4, 2026",
    size: "1.1 MB",
    sizeBytes: "1153434",
    access: DEMO_ACCOUNT.email,
    accountEmail: DEMO_ACCOUNT.email,
    accountProvider: "Google Drive",
    kind: "image",
    shared: 1,
  },
  {
    id: "file-3",
    name: "launch-cut.mp4",
    mimeType: "video/mp4",
    date: "Sep 3, 2026",
    size: "48 MB",
    sizeBytes: "50331648",
    access: DEMO_ACCOUNT.email,
    accountEmail: DEMO_ACCOUNT.email,
    accountProvider: "Google Drive",
    kind: "video",
    shared: 1,
  },
  {
    id: "file-4",
    name: "Budget FY26.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    date: "Sep 2, 2026",
    size: "320 KB",
    sizeBytes: "327680",
    access: DEMO_ACCOUNT.email,
    accountEmail: DEMO_ACCOUNT.email,
    accountProvider: "Google Drive",
    kind: "doc",
    shared: 1,
  },
  {
    id: "file-5",
    name: "Notes.md",
    mimeType: "text/markdown",
    date: "Sep 1, 2026",
    size: "12 KB",
    sizeBytes: "12288",
    access: DEMO_ACCOUNT.email,
    accountEmail: DEMO_ACCOUNT.email,
    accountProvider: "Google Drive",
    kind: "doc",
    shared: 1,
  },
  {
    id: "file-6",
    name: "podcast-intro.mp3",
    mimeType: "audio/mpeg",
    date: "Aug 30, 2026",
    size: "4.2 MB",
    sizeBytes: "4404019",
    access: DEMO_ACCOUNT.email,
    accountEmail: DEMO_ACCOUNT.email,
    accountProvider: "Google Drive",
    kind: "doc",
    shared: 1,
  },
  {
    id: "file-7",
    name: "archive-export.zip",
    mimeType: "application/zip",
    date: "Aug 28, 2026",
    size: "90 MB",
    sizeBytes: "94371840",
    access: DEMO_ACCOUNT.email,
    accountEmail: DEMO_ACCOUNT.email,
    accountProvider: "Google Drive",
    kind: "doc",
    shared: 1,
  },
  {
    id: "file-8",
    name: "team-photo.jpg",
    mimeType: "image/jpeg",
    date: "Aug 22, 2026",
    size: "3.8 MB",
    sizeBytes: "3984589",
    access: DEMO_ACCOUNT.email,
    accountEmail: DEMO_ACCOUNT.email,
    accountProvider: "Google Drive",
    kind: "image",
    shared: 1,
  },
];

const noop = () => undefined;

const searchProps = {
  searchValue: "",
  onSearchValueChange: noop as (value: string) => void,
  onSearchSubmit: noop,
  accounts: [DEMO_ACCOUNT],
  filterKind: "",
  filterAccountId: "",
  tags: [] as Array<{ id: string; name: string; color: string }>,
  filterTagId: "",
  filterMinSize: "",
  filterMaxSize: "",
  filterStartDate: "",
  filterEndDate: "",
  onFilterKindChange: noop as (value: string) => void,
  onFilterAccountIdChange: noop as (value: string) => void,
  onFilterTagIdChange: noop as (value: string) => void,
  onFilterMinSizeChange: noop as (value: string) => void,
  onFilterMaxSizeChange: noop as (value: string) => void,
  onFilterStartDateChange: noop as (value: string) => void,
  onFilterEndDateChange: noop as (value: string) => void,
  onApplyFilters: noop,
  onClearFilters: noop,
};

/** Full desktop dashboard chrome for the hero iframe (renders at iframe viewport size). */
export function HeroDashboardChrome({ className }: { className?: string }) {
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [filesOpen, setFilesOpen] = useState(true);
  const [fileViewMode, setFileViewMode] = useState<FileViewMode>("grid");

  return (
    <DashboardSearchProvider value={searchProps}>
      <div
        aria-hidden
        className={cn("pointer-events-none flex h-full w-full", className)}
      >
        <div className="drive-app flex h-full w-full">
          <div className="relative z-20 h-full w-[17rem] shrink-0 overflow-hidden">
            <DashboardSidebar
              safePathname="/home"
              user={DEMO_USER}
              accounts={[DEMO_ACCOUNT]}
              onLogout={noop}
              className="h-full"
            />
          </div>

          <div className="relative z-0 flex min-w-0 flex-1 flex-col overflow-hidden">
            <DashboardNavbar
              {...searchProps}
              onOpenSidebar={noop}
              showDesktopBrand={false}
              forceDesktop
            />

            <main className="min-h-0 flex-1 overflow-hidden px-8 py-6">
              <div className={dashboardContentClassName}>
                <div className="min-h-0 w-full min-w-0">
                  <PageHeader
                    title={
                      <>
                        {getTimeGreeting()},{" "}
                        <span className="text-primary">
                          {getFirstName(DEMO_USER.name)}
                        </span>
                      </>
                    }
                    actions={
                      <div className="flex w-auto flex-wrap items-center justify-end gap-2">
                        <span className="inline-flex h-10 min-w-[9.5rem] max-w-[12rem] items-center justify-between gap-2 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-foreground shadow-sm">
                          <span className="truncate">All Accounts</span>
                          <ChevronsExpandVertical className="h-3 w-3 shrink-0 text-muted" />
                        </span>
                        <span className="inline-flex h-10 min-w-[10rem] max-w-[13rem] items-center justify-between gap-2 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-foreground shadow-sm">
                          <span className="flex min-w-0 items-center gap-2">
                            <Sliders className="h-4 w-4 shrink-0 text-muted" />
                            <span className="truncate">Created (Newest)</span>
                          </span>
                          <ChevronsExpandVertical className="h-3 w-3 shrink-0 text-muted" />
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="inline-flex h-10"
                          isDisabled
                        >
                          <ArrowRotateRight className="h-4 w-4" />
                          Sync
                        </Button>
                        <FileViewToggle
                          mode={fileViewMode}
                          onChange={setFileViewMode}
                        />
                      </div>
                    }
                  />

                  <DriveSection
                    title="All Folders"
                    variant="plain"
                    open={foldersOpen}
                    onOpenChange={setFoldersOpen}
                  >
                    <FolderGrid items={DEMO_FOLDERS} sizeScale="xs" />
                  </DriveSection>

                  <DriveSection
                    title="All files"
                    variant="plain"
                    open={filesOpen}
                    onOpenChange={setFilesOpen}
                  >
                    <FileGrid
                      files={DEMO_FILES}
                      selectedFileIds={new Set()}
                      sizeScale="xs"
                    />
                  </DriveSection>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    </DashboardSearchProvider>
  );
}

/** Desktop dashboard at iframe size — used by /embed/hero-dashboard. */
export function HeroDashboardEmbed() {
  return (
    <Suspense fallback={<div className="h-full w-full bg-white" aria-hidden />}>
      <HeroDashboardChrome />
    </Suspense>
  );
}
