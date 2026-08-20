"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  
  label?: string;
};

export function AppPreloader({
  className,
  label = "Loading Archive Cloud",
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const content = (
    <div
      aria-busy="true"
      aria-live="polite"
      className={cn(
        "fixed inset-0 z-[999999] flex items-center justify-center bg-white",
        className,
      )}
      role="status"
    >
      <span className="sr-only">{label}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt=""
        className="h-28 w-28 object-contain sm:h-32 sm:w-32"
        height={128}
        src="/preloader.gif"
        width={128}
      />
    </div>
  );

  if (!mounted) return content;
  return createPortal(content, document.body);
}
