"use client";

import { ChevronDown } from "@gravity-ui/icons";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DriveSection({
  title,
  open,
  onOpenChange,
  variant = "plain",
  children,
  className,
}: {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant?: "plain" | "pill";
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mt-7 first:mt-5 sm:mt-8 sm:first:mt-6", className)}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium transition sm:text-sm",
          variant === "pill"
            ? "rounded-full border border-primary/40 bg-white px-2.5 py-1.5 text-primary hover:bg-primary/10 sm:px-3 sm:py-2 dark:border-primary/40 dark:bg-transparent dark:text-primary dark:hover:bg-primary/10"
            : "my-1 rounded-lg px-1 py-2 text-foreground hover:bg-black/5 sm:my-1 sm:px-1.5 sm:py-2 dark:hover:bg-white/10",
        )}
      >
        {variant === "plain" ? (
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted transition-transform",
              !open && "-rotate-90",
            )}
          />
        ) : null}
        <span>{title}</span>
        {variant === "pill" ? (
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 transition-transform",
              !open && "-rotate-90",
            )}
          />
        ) : null}
      </button>
      {open ? <div className="mt-4 sm:mt-5">{children}</div> : null}
    </section>
  );
}
