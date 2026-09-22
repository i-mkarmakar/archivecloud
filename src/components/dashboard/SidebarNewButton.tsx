"use client";

import { CloudArrowUpIn, FolderPlus } from "@gravity-ui/icons";
import { Popover } from "@heroui/react";
import type { ElementType } from "react";
import { useState } from "react";
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
  description,
  onClick,
}: {
  icon: ElementType;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-border/80 bg-white px-3 py-3 text-left shadow-[0_6px_14px_-8px_color-mix(in_oklch,var(--primary)_10%,transparent)] transition-opacity hover:opacity-95"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-transparent bg-gradient-to-b from-primary to-[color-mix(in_srgb,var(--primary)_85%,black)] text-primary-foreground shadow-[0_6px_14px_-8px_color-mix(in_oklch,var(--primary)_10%,transparent)]">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-foreground">{label}</span>
        <span className="mt-0.5 block text-xs font-medium text-[#7b879c]">
          {description}
        </span>
      </span>
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
  const [open, setOpen] = useState(false);

  function runAction(action: SidebarCreateAction) {
    setOpen(false);
    onNavigate?.();
    if (safePathname !== "/home") {
      router.push(`/home?action=${action}`);
      return;
    }
    dispatchSidebarCreateAction(action);
  }

  return (
    <Popover isOpen={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className={cn(
          iconOnly
            ? "inline-flex h-12 w-12 cursor-pointer items-center justify-center rounded-xl border-transparent bg-gradient-to-b from-primary to-[color-mix(in_srgb,var(--primary)_85%,black)] text-primary-foreground shadow-[0_6px_14px_-8px_color-mix(in_oklch,var(--primary)_10%,transparent)] transition-opacity hover:opacity-90"
            : "inline-flex h-11 cursor-pointer items-center gap-2.5 rounded-full bg-white px-6 text-[15px] font-semibold text-foreground shadow-sm transition-shadow hover:shadow-md",
          className,
        )}
        aria-label="New"
      >
        <PlusIcon
          className={cn("shrink-0", iconOnly ? "h-5 w-5" : "h-5 w-5")}
        />
        {iconOnly ? null : <span>New</span>}
      </Popover.Trigger>
      <Popover.Content
        placement="bottom start"
        className="w-[21rem] rounded-2xl border border-[#e6ebf2] bg-white p-px shadow-lg"
      >
        <Popover.Dialog>
          <div className="grid gap-1.5">
            <MenuItem
              icon={FolderPlus}
              label="Create folder"
              description="Organize your files"
              onClick={() => runAction("new-folder")}
            />
            <MenuItem
              icon={CloudArrowUpIn}
              label="Upload files"
              description="Add documents, images & more"
              onClick={() => runAction("upload")}
            />
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
