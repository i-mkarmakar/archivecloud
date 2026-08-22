import { Cloud } from "@gravity-ui/icons";
import { ProviderBrandIcon } from "@/components/ProviderBrandIcon";
import { cn } from "@/lib/utils";

export function GoogleDriveLogo({
  className = "h-5 w-5",
  theme = "light",
  showFallbackIcon = true,
}: {
  className?: string;
  theme?: "light" | "dark";
  showFallbackIcon?: boolean;
}) {
  return (
    <ProviderBrandIcon
      name="Google Drive"
      theme={theme}
      alt="Google Drive"
      className={className}
      fallback={
        showFallbackIcon ? (
          <Cloud className={cn(className, "text-foreground")} aria-hidden />
        ) : null
      }
    />
  );
}
