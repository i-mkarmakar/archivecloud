import type { ReactNode } from "react";
import { getBrandLogoSrc } from "@/lib/brand-icons";
import { cn } from "@/lib/utils";

export function ProviderBrandIcon({
  name,
  className,
  theme = "light",
  alt = "",
  fallback,
}: {
  name: string;
  className?: string;
  theme?: "light" | "dark";
  alt?: string;
  fallback?: ReactNode;
}) {
  const src = getBrandLogoSrc(name, theme);

  if (!src) {
    return fallback ?? null;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={cn("object-contain", className)}
      loading="lazy"
      decoding="async"
    />
  );
}
