"use client";

import { CircleInfo, Clock } from "@gravity-ui/icons";
import { cn } from "@/lib/utils";
import {
  accountLabel,
  relativeIn,
  type ConnectedAccountOption,
  type ScheduleOperation,
} from "./types";

export function ScheduleSummary({
  operation,
  kindLabel,
  fireLabel,
  startAt,
  sourceAccount,
  destAccount,
  sourceName,
  destFolderName,
  showDest,
}: {
  operation: ScheduleOperation;
  kindLabel: string;
  fireLabel: string;
  startAt: Date | null;
  sourceAccount: ConnectedAccountOption | null;
  destAccount: ConnectedAccountOption | null;
  sourceName: string | null;
  destFolderName: string | null;
  showDest: boolean;
}) {
  const title =
    operation === "delete"
      ? `Delete ${sourceName || "…"}`
      : operation === "move"
        ? `Move ${sourceName || "…"}`
        : `Copy ${sourceName || "…"}`;

  return (
    <aside className="hidden min-h-0 border-l border-border bg-[#f7f9fa] lg:flex lg:flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
          Summary
        </p>

        <div>
          <p className="text-sm font-extrabold text-foreground">{title}</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                operation === "copy" && "bg-violet-100 text-violet-700",
                operation === "move" && "bg-amber-100 text-amber-800",
                operation === "delete" && "bg-rose-100 text-rose-700",
              )}
            >
              {operation}
            </span>
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
              Folder
            </span>
          </div>
        </div>

        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="leading-snug">
            {kindLabel} · {fireLabel}
          </span>
        </div>

        <div className="space-y-2 rounded-lg border border-border bg-white p-2.5 text-xs">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
              Source
            </p>
            <p className="mt-0.5 font-semibold text-foreground">
              {accountLabel(sourceAccount)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {sourceName || "—"}
            </p>
          </div>
          {showDest ? (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                Destination
              </p>
              <p className="mt-0.5 font-semibold text-foreground">
                {accountLabel(destAccount)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {destAccount ? destFolderName || "Root / default" : "—"}
              </p>
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-primary/35 bg-primary/5 p-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-primary">
            Next runs
          </p>
          {startAt ? (
            <div className="mt-1.5 flex items-start gap-2 text-xs">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                1
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-1">
                  <p className="font-semibold leading-snug text-foreground">
                    {fireLabel}
                  </p>
                  <span className="shrink-0 rounded bg-primary px-1 py-0.5 text-[9px] font-bold uppercase text-primary-foreground">
                    Next
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {relativeIn(startAt.getTime() - Date.now())}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-1.5 text-xs text-muted">—</p>
          )}
        </div>

        <div className="flex gap-1.5 rounded-lg border border-border bg-white p-2 text-[11px] leading-snug text-muted-foreground">
          <CircleInfo className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
          <p>Failed runs only show in the schedules list. No notifications.</p>
        </div>
      </div>
    </aside>
  );
}
