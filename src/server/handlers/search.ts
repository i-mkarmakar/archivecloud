import { z } from "zod";
import { prisma } from "@/server/config/prisma";
import { requireAuthUser } from "@/server/http/auth";
import { json } from "@/server/http/responses";
import { searchAllConnectedAccounts } from "@/server/modules/search/cross-cloud-search";
import { serializeFile } from "@/server/lib/file-serialize";

export async function universalSearchHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  const url = new URL(request.url);
  const query = z
    .object({
      q: z.string().trim().min(1).max(255),
      accountId: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(50).optional(),
    })
    .parse(Object.fromEntries(url.searchParams));

  const limit = query.limit ?? 25;

  const [localFiles, clouds] = await Promise.all([
    prisma.file.findMany({
      where: {
        userId: user.id,
        status: "active",
        deletedAt: null,
        isArchived: false,
        name: { contains: query.q, mode: "insensitive" },
        ...(query.accountId ? { connectedAccountId: query.accountId } : {}),
      },
      include: {
        connectedAccount: {
          select: {
            id: true,
            email: true,
            provider: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        folder: { select: { id: true, name: true } },
        fileTags: { include: { tag: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    }),
    searchAllConnectedAccounts({
      userId: user.id,
      query: query.q,
      accountId: query.accountId,
      limitPerAccount: limit,
    }),
  ]);

  return json({
    query: query.q,
    localFiles: localFiles.map(serializeFile),
    clouds,
  });
}
