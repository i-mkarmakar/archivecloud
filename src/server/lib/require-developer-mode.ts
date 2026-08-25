import { prisma } from "@/server/config/prisma";
import type { AuthUser } from "@/server/http/auth";
import { errorJson } from "@/server/http/responses";

export async function requireDeveloperMode(
  user: AuthUser,
): Promise<Response | null> {
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { developerModeEnabled: true },
  });
  if (!row?.developerModeEnabled) {
    return errorJson(
      "DEVELOPER_MODE_REQUIRED",
      "Enable Developer Console in Settings first.",
      403,
    );
  }
  return null;
}
