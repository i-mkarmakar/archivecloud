import { cn } from "@/lib/utils";

export function BrandLogo({ className }: { className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="Archive Cloud"
      className={cn("h-10 w-10 object-contain", className)}
    />
  );
}
