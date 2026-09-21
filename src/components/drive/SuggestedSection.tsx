"use client";

import { ChevronDown } from "@gravity-ui/icons";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SuggestedSection({
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
    <section className={cn("mt-7 first:mt-4", className)}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className={cn(
          "inline-flex items-center gap-1.5 text-sm font-medium transition",
          variant === "pill"
            ? "rounded-full border border-[#a8c7fa] bg-white px-3 py-2 text-[#0b57d0] hover:bg-[#e8f0fe] dark:border-primary/40 dark:bg-transparent dark:text-primary dark:hover:bg-primary/10"
            : "my-1 rounded-lg px-1.5 py-2 text-foreground hover:bg-black/5 dark:hover:bg-white/10",
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
      {open ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}
