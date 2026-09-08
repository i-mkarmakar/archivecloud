import { z } from "zod";
import { prisma } from "@/server/config/prisma";
import { requireAuthUser } from "@/server/http/auth";
import { json } from "@/server/http/responses";

function parseMetadata(raw: unknown): unknown {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return raw;
    }
  }
  return raw;
}

function humanAction(action: string): string {
  return action
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function listAuditLogsHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  const url = new URL(request.url);
  const query = z
    .object({
      limit: z.coerce.number().int().min(1).max(200).default(50),
      cursor: z.string().min(1).optional(),
    })
    .parse({
      limit: url.searchParams.get("limit") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
    });

  const logs = await prisma.auditLog.findMany({
    where: { userId: user.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    ...(query.cursor
      ? {
          cursor: { id: query.cursor },
          skip: 1,
        }
      : {}),
  });

  const hasMore = logs.length > query.limit;
  const page = hasMore ? logs.slice(0, query.limit) : logs;
  const nextCursor = hasMore ? page[page.length - 1]?.id : null;

  return json({
    logs: page.map((log) => ({
      id: log.id,
      action: log.action,
      actionLabel: humanAction(log.action),
      entityType: log.entityType,
      entityId: log.entityId,
      metadata: parseMetadata(log.metadata),
      createdAt: log.createdAt.toISOString(),
    })),
    nextCursor,
  });
}
