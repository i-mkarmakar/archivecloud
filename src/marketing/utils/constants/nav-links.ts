import {
  CloudIcon,
  FolderOpenIcon,
  LineChartIcon,
  Share2Icon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavMenuItem = {
  title: string;
  tagline: string;
  href: string;
  icon: LucideIcon;
};

type NavLink = {
  title: string;
  href: string;
  menu?: NavMenuItem[];
};

export const NAV_LINKS: NavLink[] = [
  {
    title: "Features",
    href: "/#features",
    menu: [
      {
        title: "Multi-account Drive",
        tagline: "Connect and manage multiple Google Drive accounts.",
        href: "/#features",
        icon: CloudIcon,
      },
      {
        title: "Virtual folders",
        tagline: "Organize files in nested app folders.",
        href: "/#features",
        icon: FolderOpenIcon,
      },
      {
        title: "Quota routing",
        tagline: "Route uploads to accounts with free space.",
        href: "/#features",
        icon: LineChartIcon,
      },
      {
        title: "Secure sharing",
        tagline: "Share with links, previews, and invites.",
        href: "/#features",
        icon: Share2Icon,
      },
    ],
  },
  {
    title: "Pricing",
    href: "/#pricing",
  },
  {
    title: "How it works",
    href: "/#how-it-works",
  },
  {
    title: "Sign in",
    href: "/signin",
  },
];
