import { z } from "zod";
import { prisma } from "@/server/config/prisma";
import { requireAuthUser } from "@/server/http/auth";
import { errorJson, json } from "@/server/http/responses";
import {
  parseNotificationPrefs,
  type NotificationPrefs,
} from "@/server/utils/notifications";

function serializeNotification(row: {
  id: string;
  category: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: Date | null;
  metadata: unknown;
  createdAt: Date;
}) {
  return {
    id: row.id,
    category: row.category,
    type: row.type,
    title: row.title,
    body: row.body,
    href: row.href,
    readAt: row.readAt?.toISOString() ?? null,
    metadata: row.metadata ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listNotificationsHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(limitRaw)
    ? Math.min(50, Math.max(1, Math.floor(limitRaw)))
    : 20;

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.notification.count({
      where: { userId: user.id, readAt: null },
    }),
  ]);

  return json({
    notifications: notifications.map(serializeNotification),
    unreadCount,
  });
}

export async function markNotificationReadHandler(
  request: Request,
  params: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  const id = params.id;
  if (!id) return errorJson("NOT_FOUND", "Notification not found.", 404);

  const result = await prisma.notification.updateMany({
    where: { id, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  if (result.count === 0) {
    const existing = await prisma.notification.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return errorJson("NOT_FOUND", "Notification not found.", 404);
    }
  }

  const unreadCount = await prisma.notification.count({
    where: { userId: user.id, readAt: null },
  });
  return json({ status: "ok", unreadCount });
}

export async function markAllNotificationsReadHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  return json({ status: "ok", unreadCount: 0 });
}

export async function getNotificationPrefsHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  const row = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { notificationPrefs: true },
  });

  return json({ prefs: parseNotificationPrefs(row.notificationPrefs) });
}

const prefsBodySchema = z.object({
  defaultNotifications: z.boolean().optional(),
  announcements: z.boolean().optional(),
});

export async function patchNotificationPrefsHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  const body = prefsBodySchema.parse(await request.json());
  const row = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { notificationPrefs: true },
  });
  const current = parseNotificationPrefs(row.notificationPrefs);
  const next: NotificationPrefs = {
    defaultNotifications:
      body.defaultNotifications ?? current.defaultNotifications,
    announcements: body.announcements ?? current.announcements,
  };

  await prisma.user.update({
    where: { id: user.id },
    data: { notificationPrefs: next },
  });

  return json({ prefs: next });
}
