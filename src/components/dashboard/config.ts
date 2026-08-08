import {
  Archive,
  Clock,
  ClockArrowRotateLeft,
  Cloud,
  CurlyBrackets,
  Gear,
  House,
  Link,
  Speedometer,
  Star,
  Terminal,
  TrashBin,
} from "@gravity-ui/icons";
import type { IconComponent } from "@/types/icons";

export type DashboardNavItem = {
  label: string;
  icon: IconComponent;
  href: string;
  disabled?: boolean;
};

export type AppMode = "workspace" | "developer";

export const workspaceNavItems: DashboardNavItem[] = [
  { label: "Files", icon: Archive, href: "/all-files" },
  { label: "Shared", icon: Link, href: "/shared" },
  { label: "Recent", icon: Clock, href: "/recent" },
  { label: "Starred", icon: Star, href: "/starred" },
  { label: "Archived", icon: Archive, href: "/archived" },
  { label: "Trash", icon: TrashBin, href: "/trash" },
  { label: "Quota Tracker", icon: Speedometer, href: "/quota" },
  { label: "Settings", icon: Gear, href: "/settings" },
];

export const developerNavItems: DashboardNavItem[] = [
  { label: "Overview", icon: House, href: "/developer" },
  { label: "API Keys", icon: CurlyBrackets, href: "/developer/api" },
  {
    label: "Storage & routing",
    icon: Speedometer,
    href: "/developer/storage",
  },
  { label: "Providers", icon: Cloud, href: "/developer/providers" },
  {
    label: "Activity",
    icon: ClockArrowRotateLeft,
    href: "/developer/activity",
  },
  { label: "Operations", icon: Terminal, href: "/developer/ops" },
];

export function isDeveloperPath(pathname: string) {
  return pathname === "/developer" || pathname.startsWith("/developer/");
}

/** @deprecated Use workspaceNavItems or developerNavItems */
export const dashboardNavItems = workspaceNavItems;
