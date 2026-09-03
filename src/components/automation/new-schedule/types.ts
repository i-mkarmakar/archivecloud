import type { FileItem } from "@/data/drive-data";
import { providerLabel } from "@/lib/providers";

export type ScheduleOperation = "copy" | "move" | "delete";
export type ScheduleKind = "once" | "daily" | "weekly" | "monthly";

export type ConnectedAccountOption = {
  id: string;
  email: string;
  displayName?: string | null;
  provider: string;
};

export type BrowseFolder = { id: string; name: string };

export type CreateSchedulePayload = {
  sourceFileId: string;
  destAccountId?: string;
  destParentId: string | null;
  operation: ScheduleOperation;
  scheduleKind: ScheduleKind;
  startAt: string;
  name: string;
};

export function localTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function defaultLocalDateTime() {
  const d = new Date(Date.now() + 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export function combineLocalToIso(date: string, time: string) {
  const parsed = new Date(`${date}T${time}`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function formatFireLabel(startAt: Date | null, tz: string) {
  if (!startAt) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${startAt.getFullYear()}-${pad(startAt.getMonth() + 1)}-${pad(startAt.getDate())} ${pad(startAt.getHours())}:${pad(startAt.getMinutes())} ${tz}`;
}

export function relativeIn(ms: number) {
  if (!Number.isFinite(ms)) return "—";
  if (ms <= 0) return "now";
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `in ${mins} min${mins === 1 ? "" : "s"}`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

export function accountLabel(account: ConnectedAccountOption | null) {
  if (!account) return "—";
  return `${providerLabel(account.provider)} · ${account.displayName || account.email}`;
}

export function scheduleKindLabel(kind: ScheduleKind) {
  if (kind === "once") return "One-time";
  if (kind === "daily") return "Daily";
  if (kind === "weekly") return "Weekly";
  return "Monthly";
}

export function buildAutoName(opts: {
  operation: ScheduleOperation;
  sourceName?: string | null;
  destFolderName?: string | null;
}) {
  const op =
    opts.operation === "delete"
      ? "Delete"
      : opts.operation === "move"
        ? "Move"
        : "Copy";
  const from = opts.sourceName || "folder";
  if (opts.operation === "delete") return `${op} ${from}`;
  return `${op} ${from} → ${opts.destFolderName || "folder"}`;
}

export function filesForAccount(files: FileItem[], accountId: string) {
  return files.filter(
    (f) => Boolean(f.id) && f.connectedAccountId === accountId,
  );
}
