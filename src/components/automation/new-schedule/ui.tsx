"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ScheduleStep({
  n,
  title,
  description,
  children,
}: {
  n: number;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
          {n}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-extrabold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="pl-7">{children}</div>
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
  return (
    <label className="relative block min-w-0 flex-1">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted">
        {icon}
      </span>
      <select
        className={cn(
          "h-9 w-full appearance-none rounded-lg border border-border bg-white py-1.5 pl-8 pr-7 text-xs font-medium",
          disabled
            ? "cursor-not-allowed text-muted-foreground opacity-70"
            : "text-foreground",
        )}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
