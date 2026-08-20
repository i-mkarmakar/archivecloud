"use client";

import { Popover } from "@heroui/react";
import { ArrowUpFromLine, FolderPlus } from "@gravity-ui/icons";
import type { ElementType } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export type SidebarCreateAction = "upload" | "new-folder";

export const SIDEBAR_CREATE_EVENT = "archivecloud:sidebar-create";

function dispatchSidebarCreateAction(action: SidebarCreateAction) {
  window.dispatchEvent(
    new CustomEvent(SIDEBAR_CREATE_EVENT, { detail: { action } }),
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-semibold text-foreground transition-colors hover:bg-surface-secondary"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-secondary text-muted transition-colors group-hover:bg-white group-hover:shadow-sm">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="flex-1 text-left">{label}</span>
    </button>
  );
}

export function SidebarNewButton({
  safePathname,
  onNavigate,
  className,
  iconOnly = false,
}: {
  safePathname: string;
  onNavigate?: () => void;
  className?: string;
  iconOnly?: boolean;
}) {
  const router = useRouter();

  function runAction(action: SidebarCreateAction) {
    onNavigate?.();
    if (safePathname !== "/home") {
      router.push(`/home?action=${action}`);
      return;
    }
    dispatchSidebarCreateAction(action);
  }

  return (
    <Popover>
      <Popover.Trigger
        className={cn(
          iconOnly
            ? "inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl bg-[#1877f2] text-white shadow-sm transition-opacity hover:opacity-90"
            : "inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-foreground shadow-sm transition-shadow hover:shadow-md",
          className,
        )}
        aria-label="New"
      >
        <PlusIcon
          className={cn(
            "shrink-0",
            iconOnly ? "h-5 w-5" : "h-[18px] w-[18px]",
          )}
        />
        {iconOnly ? null : <span>New</span>}
      </Popover.Trigger>
      <Popover.Content placement="bottom start" className="w-52 p-1.5">
        <Popover.Dialog>
          <MenuItem
            icon={ArrowUpFromLine}
            label="File upload"
            onClick={() => runAction("upload")}
          />
          <MenuItem
            icon={FolderPlus}
            label="New folder"
            onClick={() => runAction("new-folder")}
          />
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
