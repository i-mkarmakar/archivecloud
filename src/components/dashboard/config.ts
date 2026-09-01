import {
  Archive,
  Gear,
  House,
  Link,
  Speedometer,
  Star,
  TrashBin,
} from "@gravity-ui/icons";
import type { IconComponent } from "@/types/icons";

export type DashboardNavItem = {
  label: string;
  icon: IconComponent;
  href: string;
  disabled?: boolean;
};

/** Shared max width for dashboard navbar and page content. */
export const dashboardContentClassName = "mx-auto w-full max-w-6xl";

export const dashboardNavItems: DashboardNavItem[] = [
  { label: "Home", icon: House, href: "/home" },
  { label: "Shared", icon: Link, href: "/shared" },
  { label: "Starred", icon: Star, href: "/starred" },
  { label: "Archived", icon: Archive, href: "/archived" },
  { label: "Trash", icon: TrashBin, href: "/trash" },
  { label: "Quota Tracker", icon: Speedometer, href: "/quota" },
  { label: "Settings", icon: Gear, href: "/settings" },
];
