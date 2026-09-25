"use client";

import { CloudArrowUpIn, FolderPlus } from "@gravity-ui/icons";
import { Popover } from "@heroui/react";
import { useRouter } from "next/navigation";
import type { ElementType } from "react";
import { useState } from "react";
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
  fab = false,
  disabled = false,
}: {
  safePathname: string;
  onNavigate?: () => void;
  className?: string;
  iconOnly?: boolean;
  /** Circular floating-action style (plus only). */
  fab?: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isIcon = iconOnly || fab;

  function runAction(action: SidebarCreateAction) {
    if (disabled) return;
    setOpen(false);
    onNavigate?.();
    if (safePathname !== "/home") {
      router.push(`/home?action=${action}`);
      return;
    }
    dispatchSidebarCreateAction(action);
  }

  const triggerClassName = cn(
    fab
      ? "inline-flex h-14 w-14 items-center justify-center rounded-full border-transparent transition-opacity"
      : iconOnly
        ? "inline-flex h-12 w-12 items-center justify-center rounded-xl border-transparent transition-opacity"
        : "inline-flex h-11 items-center gap-2.5 rounded-full px-6 text-[15px] font-semibold transition-shadow",
    disabled
      ? isIcon
        ? "cursor-not-allowed bg-[#dbe3ee] text-[#6b768a]"
        : "cursor-not-allowed border border-[#e2e8f0] bg-[#f1f4f8] text-[#6b768a] shadow-none"
      : isIcon
        ? "cursor-pointer bg-gradient-to-b from-primary to-[color-mix(in_srgb,var(--primary)_85%,black)] text-primary-foreground shadow-[0_8px_20px_-6px_color-mix(in_oklch,var(--primary)_45%,transparent)] hover:opacity-90"
        : "cursor-pointer bg-white text-foreground shadow-sm hover:shadow-md",
    className,
  );

  const disabledTitle =
    "Connect a cloud account to create folders or upload files";
  const plusClassName = fab ? "h-7 w-7 shrink-0" : "h-5 w-5 shrink-0";

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        aria-label="New"
        title={disabledTitle}
        className={triggerClassName}
      >
        <PlusIcon className={plusClassName} />
        {isIcon ? null : <span>New</span>}
      </button>
    );
  }

  return (
    <Popover isOpen={open} onOpenChange={setOpen}>
      <Popover.Trigger className={triggerClassName} aria-label="New">
        <PlusIcon className={plusClassName} />
        {isIcon ? null : <span>New</span>}
      </Popover.Trigger>
      <Popover.Content
        placement={fab ? "top" : "bottom start"}
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
