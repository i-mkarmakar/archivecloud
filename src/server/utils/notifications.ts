import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "../config/prisma";

export type NotificationCategory = "file" | "transfer" | "invite" | "account";

export type NotificationPrefs = {
  defaultNotifications: boolean;
  announcements: boolean;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  defaultNotifications: true,
  announcements: true,
};

export function parseNotificationPrefs(raw: unknown): NotificationPrefs {
  if (typeof raw === "string") {
    try {
      return parseNotificationPrefs(JSON.parse(raw) as unknown);
    } catch {
      return { ...DEFAULT_NOTIFICATION_PREFS };
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_NOTIFICATION_PREFS };
  }
  const obj = raw as Record<string, unknown>;
  return {
    defaultNotifications:
      typeof obj.defaultNotifications === "boolean"
        ? obj.defaultNotifications
        : DEFAULT_NOTIFICATION_PREFS.defaultNotifications,
    announcements:
      typeof obj.announcements === "boolean"
        ? obj.announcements
        : DEFAULT_NOTIFICATION_PREFS.announcements,
  };
}

export async function createNotification(input: {
  userId: string;
  category: NotificationCategory;
  type: string;
  title: string;
  body?: string;
  href?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { notificationPrefs: true },
    });
    if (!user) return;

    const prefs = parseNotificationPrefs(user.notificationPrefs);
    if (!prefs.defaultNotifications) return;

    await prisma.notification.create({
      data: {
        userId: input.userId,
        category: input.category,
        type: input.type,
        title: input.title.slice(0, 191),
        body: input.body?.slice(0, 512) ?? null,
        href: input.href?.slice(0, 512) ?? null,
        metadata: input.metadata ?? undefined,
      },
    });
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
}

const PROVIDER_LABELS: Record<string, string> = {
  google_drive: "Google Drive",
  google_photos: "Google Photos",
  google_shared_drive: "Google Shared Drive",
  dropbox: "Dropbox",
  onedrive: "OneDrive",
  pcloud: "pCloud",
  icloud_drive: "iCloud Drive",
  icloud_photos: "iCloud Photos",
};

export async function notifyAccountConnected(input: {
  userId: string;
  provider: string;
  accountId?: string;
  displayName?: string | null;
}) {
  const label = PROVIDER_LABELS[input.provider] ?? input.provider;
  await createNotification({
    userId: input.userId,
    category: "account",
    type: "ACCOUNT_CONNECTED",
    title: `${label} connected`,
    body: input.displayName
      ? `${input.displayName} is ready to use.`
      : `Your ${label} account is ready to use.`,
    href: "/settings#settings-accounts",
    metadata: {
      provider: input.provider,
      ...(input.accountId ? { accountId: input.accountId } : {}),
    },
  });
}
