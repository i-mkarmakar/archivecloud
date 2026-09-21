"use client";

import React, { type SVGProps, useState } from "react";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { cn } from "@/lib/utils";

export const StickyBanner = ({
  className,
  children,
  hideOnScroll = false,
  onOpenChange,
}: {
  className?: string;
  children: React.ReactNode;
  hideOnScroll?: boolean;
  onOpenChange?: (open: boolean) => void;
}) => {
  const [open, setOpen] = useState(true);
  const { scrollY } = useScroll();

  const updateOpen = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  useMotionValueEvent(scrollY, "change", (latest) => {
    if (!hideOnScroll) return;
    updateOpen(latest <= 40);
  });

  return (
    <motion.div
      className={cn(
        "sticky inset-x-0 top-0 z-40 flex min-h-14 w-full items-center justify-center bg-transparent px-4 py-1",
        className,
      )}
      initial={{
        y: -100,
        opacity: 0,
      }}
      animate={{
        y: open ? 0 : -100,
        opacity: open ? 1 : 0,
      }}
      transition={{
        duration: 0.3,
        ease: "easeInOut",
      }}
      style={{ pointerEvents: open ? "auto" : "none" }}
    >
      {children}

      <motion.button
        type="button"
        aria-label="Dismiss banner"
        initial={{
          scale: 0,
        }}
        animate={{
          scale: 1,
        }}
        className="absolute top-1/2 right-5 -translate-y-1/2 cursor-pointer text-current sm:right-6"
        onClick={() => updateOpen(!open)}
      >
        <CloseIcon className="h-5 w-5" />
      </motion.button>
    </motion.div>
  );
};

const CloseIcon = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M18 6l-12 12" />
      <path d="M6 6l12 12" />
    </svg>
  );
};
