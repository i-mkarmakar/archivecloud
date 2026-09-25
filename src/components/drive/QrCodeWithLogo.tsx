"use client";

import { BrandLogo } from "@/components/drive/BrandLogo";
import { cn } from "@/lib/utils";

export function qrCodeImageUrl(data: string, size = 320) {
  // Generous quiet zone so finder corners never sit on the rounded clip edge.
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&ecc=H&margin=24&color=1e9df1&bgcolor=ffffff&data=${encodeURIComponent(data)}`;
}

export function QrCodeWithLogo({
  src,
  alt,
  className,
  sizeClassName = "h-56 w-56",
}: {
  src: string;
  alt: string;
  className?: string;
  sizeClassName?: string;
}) {
  return (
    <div
      className={cn(
        "relative rounded-2xl border border-border bg-background p-3 shadow-sm",
        className,
      )}
    >
      {/* No overflow clip — keep full finder corners visible */}
      <div className={cn("relative", sizeClassName)}>
        {/* biome-ignore lint/performance/noImgElement: external QR image */}
        <img src={src} alt={alt} className="h-full w-full object-contain" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-white shadow-[0_2px_8px_rgba(15,23,42,0.12)]">
            <BrandLogo className="h-7 w-7" />
          </div>
        </div>
      </div>
    </div>
  );
}
