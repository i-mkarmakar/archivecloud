import { Folder } from "@gravity-ui/icons";
import type { FolderItem } from "@/data/drive-data";
import { cn } from "@/lib/utils";

const legacyColorMap: Record<string, string> = {
  "text-muted": "#64748b",
  "text-lime-500": "#94a3b8",
  "text-cyan-400": "#cbd5e1",
  "text-yellow-400": "#e2e8f0",
  "text-orange-500": "#475569",
};

export const defaultFolderColor = "#6366f1";
export const defaultFolderIconUrl =
  "https://api.iconify.design/gravity-ui/folder.svg";

const folderIconOptionList = [
  { label: "Folder", url: defaultFolderIconUrl },
  {
    label: "Folder Open",
    url: "https://api.iconify.design/gravity-ui/folder-open.svg",
  },
  {
    label: "Folders",
    url: "https://api.iconify.design/gravity-ui/folders.svg",
  },
  { label: "Files", url: "https://api.iconify.design/gravity-ui/files.svg" },
  {
    label: "File Text",
    url: "https://api.iconify.design/gravity-ui/file-text.svg",
  },
  {
    label: "File Image",
    url: "https://api.iconify.design/gravity-ui/picture.svg",
  },
  {
    label: "File Video",
    url: "https://api.iconify.design/gravity-ui/video.svg",
  },
  {
    label: "File Music",
    url: "https://api.iconify.design/gravity-ui/music-note.svg",
  },
  {
    label: "File Code",
    url: "https://api.iconify.design/gravity-ui/file-code.svg",
  },
  {
    label: "File Archive",
    url: "https://api.iconify.design/gravity-ui/archive.svg",
  },
  {
    label: "Briefcase",
    url: "https://api.iconify.design/gravity-ui/briefcase.svg",
  },
  { label: "Cloud", url: "https://api.iconify.design/gravity-ui/cloud.svg" },
  {
    label: "Cloud Upload",
    url: "https://api.iconify.design/gravity-ui/cloud-arrow-up-in.svg",
  },
  {
    label: "Cloud Download",
    url: "https://api.iconify.design/gravity-ui/cloud-arrow-down-out.svg",
  },
  {
    label: "Hard Drive",
    url: "https://api.iconify.design/gravity-ui/hard-drive.svg",
  },
  {
    label: "Database",
    url: "https://api.iconify.design/gravity-ui/database.svg",
  },
  { label: "Server", url: "https://api.iconify.design/gravity-ui/server.svg" },
  {
    label: "Headphones",
    url: "https://api.iconify.design/gravity-ui/headphones.svg",
  },
  { label: "Code", url: "https://api.iconify.design/gravity-ui/code.svg" },
  {
    label: "Terminal",
    url: "https://api.iconify.design/gravity-ui/terminal.svg",
  },
  { label: "Package", url: "https://api.iconify.design/gravity-ui/box.svg" },
  {
    label: "Book Open",
    url: "https://api.iconify.design/gravity-ui/book-open.svg",
  },
  {
    label: "Graduation Cap",
    url: "https://api.iconify.design/gravity-ui/graduation-cap.svg",
  },
  {
    label: "Receipt",
    url: "https://api.iconify.design/gravity-ui/receipt.svg",
  },
  { label: "Wallet", url: "https://api.iconify.design/gravity-ui/wallet.svg" },
  {
    label: "Chart",
    url: "https://api.iconify.design/gravity-ui/chart-column.svg",
  },
  {
    label: "Calendar",
    url: "https://api.iconify.design/gravity-ui/calendar.svg",
  },
  { label: "Clock", url: "https://api.iconify.design/gravity-ui/clock.svg" },
  { label: "Users", url: "https://api.iconify.design/gravity-ui/persons.svg" },
  {
    label: "User Check",
    url: "https://api.iconify.design/gravity-ui/person.svg",
  },
  { label: "Share", url: "https://api.iconify.design/gravity-ui/link.svg" },
  { label: "Lock", url: "https://api.iconify.design/gravity-ui/lock.svg" },
  { label: "Shield", url: "https://api.iconify.design/gravity-ui/shield.svg" },
  { label: "Star", url: "https://api.iconify.design/gravity-ui/star.svg" },
  { label: "Heart", url: "https://api.iconify.design/gravity-ui/heart.svg" },
  { label: "Rocket", url: "https://api.iconify.design/gravity-ui/rocket.svg" },
  {
    label: "Sparkles",
    url: "https://api.iconify.design/gravity-ui/sparkles.svg",
  },
] as const;

export const folderIconOptions = folderIconOptionList.filter(
  (option, index, options) =>
    options.findIndex((item) => item.url === option.url) === index,
);

export const folderColorOptions = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#64748b",
  "#94a3b8",
  "#cbd5e1",
];

export function normalizeFolderColor(color?: string | null) {
  if (color?.startsWith("#")) return color;
  return legacyColorMap[color ?? ""] ?? defaultFolderColor;
}

export function iconUrlWithColor(iconUrl: string, color: string) {
  const separator = iconUrl.includes("?") ? "&" : "?";
  return `${iconUrl}${separator}color=${encodeURIComponent(color)}`;
}

export function FolderVisual({
  folder,
  className,
  iconClassName,
}: {
  folder: Pick<FolderItem, "color" | "iconUrl">;
  className?: string;
  iconClassName?: string;
}) {
  const color = normalizeFolderColor(folder.color);
  const iconUrl = folder.iconUrl || defaultFolderIconUrl;
  return (
    <span className={cn("inline-flex items-center justify-center", className)}>
      {iconUrl ? (
        <img
          src={iconUrlWithColor(iconUrl, color)}
          alt=""
          className={cn("h-full w-full object-contain", iconClassName)}
        />
      ) : (
        <Folder
          className={cn(
            "h-full w-full fill-current stroke-current",
            iconClassName,
          )}
          style={{ color }}
        />
      )}
    </span>
  );
}
