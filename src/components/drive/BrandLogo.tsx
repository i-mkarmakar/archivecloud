import { cn } from "@/lib/utils";

export function BrandLogo({
  className,
  thunder = false,
}: {
  className?: string;
  thunder?: boolean;
}) {
  return (
    <img
      src={thunder ? "/logo-thunder.png" : "/logo.png"}
      alt="Archive Cloud"
      suppressHydrationWarning
      className={cn(
        "h-10 w-10 object-contain",
        className,
        thunder && "translate-y-1 scale-110",
      )}
    />
  );
}
