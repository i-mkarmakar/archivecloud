"use client";

import { ChevronDown } from "@gravity-ui/icons";
import { Button, Dropdown, Label, type Selection } from "@heroui/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ScheduleStep({
  n,
  title,
  description,
  children,
  isLast = false,
  state = "active",
}: {
  n: number;
  title: string;
  description: string;
  children: ReactNode;
  isLast?: boolean;
  /** locked = not yet reachable; active = current; complete = finished */
  state?: "locked" | "active" | "complete";
}) {
  const locked = state === "locked";
  const complete = state === "complete";

  return (
    <section
      className={cn("relative space-y-2", !isLast && "pb-6")}
      aria-disabled={locked || undefined}
    >
      {!isLast ? (
        <span
          aria-hidden
          className={cn(
            "absolute top-6 bottom-0 left-[9px] w-px",
            complete ? "bg-primary/40" : "bg-border",
          )}
        />
      ) : null}
      <div className="relative flex items-start gap-2">
        <span
          className={cn(
            "relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ring-4 ring-white",
            locked && "bg-surface-secondary text-muted-foreground",
            state === "active" && "bg-primary text-primary-foreground",
            complete && "bg-primary text-primary-foreground",
          )}
        >
          {n}
        </span>
        <div className={cn("min-w-0 flex-1", locked && "opacity-50")}>
          <h3
            className={cn(
              "text-sm font-extrabold",
              locked ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {title}
          </h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div
        className={cn(
          "relative pl-7",
          locked && "pointer-events-none opacity-40",
        )}
      >
        {children}
      </div>
    </section>
  );
}

export function OpCard({
  active,
  label,
  icon,
  tone,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: ReactNode;
  tone: "violet" | "amber" | "rose";
  onClick: () => void;
}) {
  const tones = {
    violet: {
      active: "border-violet-400 bg-violet-50 text-violet-700",
      icon: "bg-violet-100 text-violet-600",
    },
    amber: {
      active: "border-amber-400 bg-amber-50 text-amber-800",
      icon: "bg-amber-100 text-amber-600",
    },
    rose: {
      active: "border-rose-400 bg-rose-50 text-rose-700",
      icon: "bg-rose-100 text-rose-600",
    },
  } as const;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-lg border px-2 py-2 text-xs font-bold transition-colors sm:flex-col sm:gap-1.5 sm:py-2.5",
        active
          ? tones[tone].active
          : "border-border bg-white text-foreground hover:bg-surface-secondary",
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-lg",
          active ? tones[tone].icon : "bg-surface-secondary text-muted",
        )}
      >
        {icon}
      </span>
      {label}
    </button>
  );
}

export function PickerSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  icon,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ id: string; label: string }>;
  placeholder: string;
  disabled?: boolean;
  icon: ReactNode;
}) {
  const selected = options.find((o) => o.id === value);
  const label = selected?.label ?? placeholder;

  return (
    <Dropdown className="min-w-0 flex-1">
      <Button
        variant="secondary"
        isDisabled={disabled || options.length === 0}
        className={cn(
          "h-9 w-full justify-between rounded-full border border-border bg-white px-3 text-xs font-medium",
          selected ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-muted">{icon}</span>
          <span className="truncate">{label}</span>
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-muted" />
      </Button>
      <Dropdown.Popover className="min-w-[220px]">
        <Dropdown.Menu
          selectionMode="single"
          selectedKeys={value ? new Set([value]) : new Set()}
          onSelectionChange={(keys: Selection) => {
            if (keys === "all") return;
            const key = [...keys][0];
            if (typeof key === "string") onChange(key);
          }}
        >
          {options.map((o) => (
            <Dropdown.Item key={o.id} id={o.id} textValue={o.label}>
              <Label>{o.label}</Label>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
