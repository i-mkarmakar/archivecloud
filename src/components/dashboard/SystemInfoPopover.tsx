"use client";

import { CircleCheck } from "@gravity-ui/icons";
import { Button, Popover, toast } from "@heroui/react";
import { NotificationBell } from "@/components/ui/notification-bell";

export function SystemInfoPopover() {
  return (
    <Popover>
      <Popover.Trigger
        aria-label="Notifications"
        className="inline-flex rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <NotificationBell asChild count={0} size={28} color="red">
          <span />
        </NotificationBell>
      </Popover.Trigger>
      <Popover.Content
        placement="bottom end"
        className="w-[min(calc(100vw-2rem),24rem)] rounded-xl! p-0"
      >
        <Popover.Dialog className="rounded-xl! p-0">
          <div className="flex items-center justify-between gap-3 border-b border-separator px-4 py-3.5">
            <Popover.Heading className="text-lg font-extrabold">
              Notifications
            </Popover.Heading>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-sm font-semibold text-primary"
              onPress={() => toast.success("All notifications marked as read.")}
            >
              Mark all as read
            </Button>
          </div>
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-[#e8f8ee] text-[#1f8f4e]">
              <CircleCheck className="size-9" aria-hidden />
            </span>
            <div className="grid gap-1">
              <p className="text-base font-bold text-foreground">
                You&apos;re all caught up
              </p>
              <p className="text-sm text-muted">
                New notifications will show up here.
              </p>
            </div>
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
