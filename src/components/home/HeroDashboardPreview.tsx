"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Desktop iframe viewport — xl breakpoints apply so grids match the real app. */
export const HERO_DASHBOARD_WIDTH = 1280;
export const HERO_DASHBOARD_HEIGHT = 800;

/**
 * Scales a real desktop-viewport iframe of the dashboard so mobile sees the
 * exact same chrome as desktop, just smaller.
 */
export function HeroDashboardPreview({ className }: { className?: string }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    function updateScale() {
      if (!frame) return;
      const width = frame.clientWidth;
      if (width <= 0) return;
      setScale(width / HERO_DASHBOARD_WIDTH);
    }

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      aria-hidden
      className={cn(
        "mx-auto w-full overflow-hidden rounded-[8px] bg-white shadow-2xl shadow-black/20 sm:rounded-xl",
        className,
      )}
    >
      <div
        ref={frameRef}
        className="relative w-full overflow-hidden bg-white"
        style={{
          height: scale > 0 ? HERO_DASHBOARD_HEIGHT * scale : undefined,
          aspectRatio:
            scale > 0
              ? undefined
              : `${HERO_DASHBOARD_WIDTH} / ${HERO_DASHBOARD_HEIGHT}`,
        }}
      >
        <iframe
          src="/embed/hero-dashboard"
          title="Archive Cloud dashboard"
          width={HERO_DASHBOARD_WIDTH}
          height={HERO_DASHBOARD_HEIGHT}
          loading="eager"
          tabIndex={-1}
          className="pointer-events-none absolute top-0 left-0 origin-top-left border-0"
          style={{
            width: HERO_DASHBOARD_WIDTH,
            height: HERO_DASHBOARD_HEIGHT,
            transform: scale > 0 ? `scale(${scale})` : undefined,
          }}
        />
      </div>
    </div>
  );
}
