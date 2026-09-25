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
    <div className="inline-flex h-9 shrink-0 items-stretch overflow-hidden rounded-lg border border-border bg-white sm:h-10 sm:rounded-xl">
      {options.map((option, index) => {
        const Icon = option.icon;
        const active = mode === option.id;
        return (
          <div key={option.id} className="flex items-stretch">
            {index > 0 ? (
              <span className="w-px self-stretch bg-border" aria-hidden />
            ) : null}
            <button
              type="button"
              aria-label={option.label}
              aria-pressed={active}
              onClick={() => onChange(option.id)}
              className={cn(
                "flex w-9 items-center justify-center transition sm:w-11 lg:w-12",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted hover:bg-black/5 hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
