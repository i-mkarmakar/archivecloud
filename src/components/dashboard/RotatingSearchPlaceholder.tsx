"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const FADE_MS = 300;
const DISPLAY_MS = 2800;

export function RotatingSearchPlaceholder({
  terms,
  paused = false,
}: {
  terms: readonly string[];
  paused?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (paused || terms.length <= 1) return;

    let swapTimer: number | undefined;

    const cycleTimer = window.setInterval(() => {
      setVisible(false);
      swapTimer = window.setTimeout(() => {
        setIndex((current) => (current + 1) % terms.length);
        setVisible(true);
      }, FADE_MS);
    }, DISPLAY_MS);

    return () => {
      window.clearInterval(cycleTimer);
      if (swapTimer) window.clearTimeout(swapTimer);
    };
  }, [paused, terms.length]);

  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 start-9 z-10 flex items-center gap-0 text-sm leading-none text-field-placeholder sm:text-sm"
    >
      <span>Search&nbsp;</span>
      <span className="inline-flex h-[1.25em] items-center overflow-hidden">
        <span
          className={cn(
            "inline-block transition-all duration-500 ease-in-out motion-reduce:transition-none",
            visible
              ? "translate-y-0 opacity-100"
              : "translate-y-full opacity-0",
          )}
        >
          {terms[index]}
        </span>
      </span>
    </span>
  );
}
