"use client";

import { Cloud } from "@gravity-ui/icons";
import { useSvglLogo } from "@/hooks/useSvglLogo";
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
  const src = useSvglLogo("Google Drive", { theme });

  if (!src) {
    if (!showFallbackIcon) return null;
    return <Cloud className={cn(className, "text-foreground")} aria-hidden />;
  }

  return (
    <img
      src={src}
      alt="Google Drive"
      className={cn(className, "object-contain")}
      loading="lazy"
      decoding="async"
    />
  );
}
