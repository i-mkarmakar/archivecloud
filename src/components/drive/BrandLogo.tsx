import { cn } from "@/lib/utils";

export function BrandLogo({ className }: { className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="ArchiveCloud"
      className={cn("h-10 w-10 object-contain", className)}
    />
  );
}
