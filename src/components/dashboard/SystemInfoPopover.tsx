"use client";

import { CircleCheck } from "@gravity-ui/icons";
import { Button, Popover, toast } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { NotificationBell } from "@/components/ui/notification-bell";
import { apiFetch, formatDate } from "@/lib/api";
import { cn } from "@/lib/utils";

type NotificationItem = {
  id: string;
  category: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

type NotificationsResponse = {
  notifications: NotificationItem[];
  unreadCount: number;
};

export function SystemInfoPopover() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<NotificationsResponse>(
        "/notifications?limit=20",
      );
      setItems(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // Keep last known state.
    }
  }, []);

  useEffect(() => {
    void load();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    const interval = window.setInterval(() => void load(), 60_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(interval);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void load().finally(() => setLoading(false));
    const interval = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(interval);
  }, [open, load]);

  async function markAllRead() {
    try {
      await apiFetch("/notifications/read-all", { method: "POST" });
      setItems((prev) =>
        prev.map((n) => ({
          ...n,
          readAt: n.readAt ?? new Date().toISOString(),
        })),
      );
      setUnreadCount(0);
      toast.success("All notifications marked as read.");
    } catch (error) {
      toast.danger(
        error instanceof Error ? error.message : "Could not mark as read.",
      );
    }
  }

  async function openItem(item: NotificationItem) {
    if (!item.readAt) {
      try {
        const data = await apiFetch<{ unreadCount: number }>(
          `/notifications/${item.id}/read`,
          { method: "PATCH" },
        );
        setUnreadCount(data.unreadCount);
        setItems((prev) =>
          prev.map((n) =>
            n.id === item.id
              ? { ...n, readAt: n.readAt ?? new Date().toISOString() }
              : n,
          ),
        );
      } catch {
        // Still navigate if href exists.
      }
    }
    setOpen(false);
    if (item.href) router.push(item.href);
  }

  return (
    <Popover isOpen={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        className="inline-flex shrink-0 cursor-pointer rounded-full p-0 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <NotificationBell
          interactive={false}
          count={unreadCount}
          size={36}
          color="red"
        />
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
              isDisabled={unreadCount === 0}
              onPress={() => void markAllRead()}
            >
              Mark all as read
            </Button>
          </div>
          {loading && items.length === 0 ? (
            <div className="flex min-h-56 items-center justify-center px-6 py-10 text-sm text-muted">
              Loading…
            </div>
          ) : items.length === 0 ? (
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
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {items.map((item) => {
                const unread = !item.readAt;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => void openItem(item)}
                      className={cn(
                        "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-default-100",
                        unread && "bg-primary/5",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          unread ? "bg-primary" : "bg-transparent",
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground">
                          {item.title}
                        </span>
                        {item.body ? (
                          <span className="mt-0.5 line-clamp-2 block text-xs text-muted">
                            {item.body}
                          </span>
                        ) : null}
                        <span className="mt-1 block text-[11px] text-muted">
                          {formatDate(item.createdAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
