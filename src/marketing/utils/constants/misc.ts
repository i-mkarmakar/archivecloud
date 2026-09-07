import { CloudIcon, FolderOpenIcon, Share2Icon } from "lucide-react";

export const DEFAULT_AVATAR_URL =
  "https://api.dicebear.com/8.x/initials/svg?backgroundType=gradientLinear&backgroundRotation=0,360&seed=";

export const PAGINATION_LIMIT = 10;

export const PROCESS = [
  {
    title: "Create your account",
    description:
      "Sign up with email or Google and set up your ArchiveCloud workspace in seconds.",
    icon: CloudIcon,
  },
  {
    title: "Connect Google Drive",
    description:
      "Link one or more Drive accounts and see combined quota at a glance.",
    icon: FolderOpenIcon,
  },
  {
    title: "Upload, organize, share",
    description:
      "Drop files in, sort into virtual folders, and share with teammates or the world.",
    icon: Share2Icon,
  },
] as const;
