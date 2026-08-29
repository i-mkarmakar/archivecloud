import { prisma } from "@/server/config/prisma";
import { requireAuthUser } from "@/server/http/auth";
import { json } from "@/server/http/responses";

export async function listAuditLogsHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const parsed = limitParam ? Number(limitParam) : 100;
  const take = Number.isFinite(parsed)
    ? Math.min(100, Math.max(1, Math.floor(parsed)))
    : 100;

  const logs = await prisma.auditLog.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take,
  });
  return json({ logs });
}
