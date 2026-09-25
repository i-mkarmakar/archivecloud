"use client";

import { Calendar, LayoutCells, ListUl } from "@gravity-ui/icons";
import { cn } from "@/lib/utils";

export type FileViewMode = "list" | "grid" | "calendar";

export function FileViewToggle({
  mode,
  onChange,
}: {
  mode: FileViewMode;
  onChange: (mode: FileViewMode) => void;
}) {
  const options: { id: FileViewMode; label: string; icon: typeof ListUl }[] = [
    { id: "list", label: "Show as list", icon: ListUl },
    { id: "grid", label: "Show as grid", icon: LayoutCells },
    { id: "calendar", label: "Show as calendar", icon: Calendar },
  ];

  return (
    <div className="inline-flex h-9 shrink-0 overflow-hidden rounded-lg border border-border bg-white sm:h-10 sm:rounded-xl">
      {options.map((option, index) => {
        const Icon = option.icon;
        const active = mode === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-label={option.label}
            aria-pressed={active}
            onClick={() => onChange(option.id)}
            className={cn(
              "flex h-full items-center justify-center px-2.5 transition sm:px-3 lg:px-3.5",
              index > 0 && "border-l border-border",
              active
                ? "bg-primary text-primary-foreground"
                : "bg-transparent text-muted hover:bg-black/5 hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
        );
      })}
    </div>
  );
}
