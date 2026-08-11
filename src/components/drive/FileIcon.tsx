import { Archive, Folder, Picture, Play } from "@gravity-ui/icons";
import type { FileItem } from "@/data/drive-data";
import { cn } from "@/lib/utils";

export function FileIcon({
  kind,
  className,
}: {
  kind: FileItem["kind"];
  className?: string;
}) {
  const base = "h-4 w-4 rounded-sm p-0.5 text-accent-foreground";
  if (kind === "image")
    return <Picture className={cn(base, "bg-success", className)} />;
  if (kind === "video")
    return <Play className={cn(base, "bg-accent", className)} />;
  if (kind === "pdf")
    return <Archive className={cn(base, "bg-danger", className)} />;
  return <Folder className={cn(base, "bg-warning", className)} />;
}
