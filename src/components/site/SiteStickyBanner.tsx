"use client";

import { StickyBanner } from "@/components/ui/sticky-banner";
import { GITHUB_REPO_URL } from "@/components/site/nav-links";

export function SiteStickyBanner({
  onOpenChange,
}: {
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <StickyBanner
      hideOnScroll
      onOpenChange={onOpenChange}
      className="fixed inset-x-0 top-0 z-[100000] bg-gradient-to-b from-blue-500 to-blue-600 text-white"
    >
      <p className="mx-0 flex max-w-[90%] flex-wrap items-center justify-center gap-x-1 text-center text-sm leading-none text-white drop-shadow-md sm:text-[15px]">
        <span>Latest release is live:</span>
        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center font-semibold underline transition duration-200 hover:opacity-90"
        >
          <span>Star on GitHub</span>
          <img
            src="/assets/Star.gif"
            alt=""
            aria-hidden
            className="-ml-2 size-10 shrink-0 object-contain"
          />
        </a>
      </p>
    </StickyBanner>
  );
}
