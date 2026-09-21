import {
  ArrowRotateLeft,
  Clock,
  ClockArrowRotateLeft,
  FolderFill,
  Folders,
  Persons,
  Thunderbolt,
} from "@gravity-ui/icons";
import type { IconComponent } from "@/types/icons";

export type DashboardNavItem = {
  label: string;
  icon: IconComponent;
  href: string;
  disabled?: boolean;
  badge?: string;
};

export type DashboardNavSection = {
  id: string;
  title: string;
  items: DashboardNavItem[];
  
  showAccountCount?: boolean;
};

export const dashboardContentClassName = "mx-auto w-full max-w-6xl";

export const dashboardNavSections: DashboardNavSection[] = [
  {
    id: "workspace",
    title: "Workspace",
    items: [
      { label: "All Files", icon: FolderFill, href: "/home" },
      { label: "Shared with me", icon: Persons, href: "/shared" },
      { label: "Virtual Folders", icon: Folders, href: "/virtual-folders" },
      { label: "Recent", icon: Clock, href: "/recent" },
    ],
  },
  {
    id: "routines",
    title: "Routines",
    items: [
      {
        label: "Auto-Sync",
        icon: Thunderbolt,
        href: "/automation?view=sync",
        badge: "Thunder",
      },
      {
        label: "Schedule Tasks",
        icon: ClockArrowRotateLeft,
        href: "/automation?view=schedule",
      },
      {
        label: "Run History",
        icon: ArrowRotateLeft,
        href: "/run-history",
      },
    ],
  },
  {
    id: "linked-storage",
    title: "Linked Storage",
    showAccountCount: true,
    items: [],
  },
];
