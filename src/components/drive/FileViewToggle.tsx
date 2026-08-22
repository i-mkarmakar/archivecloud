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
    <div className="inline-flex h-10 items-stretch overflow-hidden rounded-xl border border-border bg-white">
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
                "flex w-11 items-center justify-center transition sm:w-12",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted hover:bg-black/5 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
