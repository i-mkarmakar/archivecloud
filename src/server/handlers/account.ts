import { prisma } from "@/server/config/prisma";
import { requireAuthUser } from "@/server/http/auth";
import { json } from "@/server/http/responses";

export async function getAccountHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  const row = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      email: true,
      developerModeEnabled: true,
      developerModeEnabledAt: true,
    },
  });

  return json({
    account: {
      id: row.id,
      name: row.name,
      email: row.email,
      developerModeEnabled: row.developerModeEnabled,
      developerModeEnabledAt: row.developerModeEnabledAt?.toISOString() ?? null,
    },
  });
}

export async function enableDeveloperModeHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  const row = await prisma.user.update({
    where: { id: user.id },
    data: {
      developerModeEnabled: true,
      developerModeEnabledAt: new Date(),
    },
    select: {
      developerModeEnabled: true,
      developerModeEnabledAt: true,
    },
  });

  return json({
    developerModeEnabled: row.developerModeEnabled,
    developerModeEnabledAt: row.developerModeEnabledAt?.toISOString() ?? null,
  });
}
