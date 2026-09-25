import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/server/config/prisma";
import { requireAuthUser } from "@/server/http/auth";
import { errorJson, json } from "@/server/http/responses";

function serializeTag(tag: {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
    createdAt: tag.createdAt.toISOString(),
    updatedAt: tag.updatedAt.toISOString(),
  };
}

type TagRow = {
  id: string;
  name: string;
  color: string;
  created_at: Date;
  updated_at: Date;
};

function hasFolderTagDelegate() {
  return (
    typeof (prisma as { folderTag?: { findMany?: unknown } }).folderTag
      ?.findMany === "function"
  );
}

async function assertFolderTagAccess(userId: string, folderKey: string) {
  if (folderKey.startsWith("account:")) {
    const accountId = folderKey.slice("account:".length);
    const account = await prisma.connectedAccount.findFirst({
      where: { id: accountId, userId },
      select: { id: true },
    });
    return Boolean(account);
  }

  if (folderKey.startsWith("linked:")) {
    const rest = folderKey.slice("linked:".length);
    const colon = rest.indexOf(":");
    if (colon <= 0) return false;
    const accountId = rest.slice(0, colon);
    const account = await prisma.connectedAccount.findFirst({
      where: { id: accountId, userId },
      select: { id: true },
    });
    return Boolean(account);
  }

  const folder = await prisma.folder.findFirst({
    where: { id: folderKey, userId, deletedAt: null },
    select: { id: true },
  });
  return Boolean(folder);
}

async function listFolderTagsForUser(userId: string, folderKey: string) {
  if (hasFolderTagDelegate()) {
    const folderTags = await prisma.folderTag.findMany({
      where: { userId, folderKey },
      include: { tag: true },
      orderBy: { createdAt: "asc" },
    });
    return folderTags.map((ft) => serializeTag(ft.tag));
  }

  const rows = await prisma.$queryRaw<TagRow[]>`
    SELECT t.id, t.name, t.color, t.created_at, t.updated_at
    FROM folder_tags ft
    INNER JOIN tags t ON t.id = ft.tag_id
    WHERE ft.user_id = ${userId}
      AND ft.folder_key = ${folderKey}
    ORDER BY ft.created_at ASC
  `;

  return rows.map((row) =>
    serializeTag({
      id: row.id,
      name: row.name,
      color: row.color,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
  );
}

async function replaceFolderTags(
  userId: string,
  folderKey: string,
  tagIds: string[],
) {
  if (hasFolderTagDelegate()) {
    await prisma.$transaction([
      prisma.folderTag.deleteMany({
        where: { userId, folderKey },
      }),
      ...(tagIds.length > 0
        ? [
            prisma.folderTag.createMany({
              data: tagIds.map((tagId) => ({
                userId,
                folderKey,
                tagId,
              })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);
    return;
  }

  await prisma.$executeRaw`
    DELETE FROM folder_tags
    WHERE user_id = ${userId}
      AND folder_key = ${folderKey}
  `;

  for (const tagId of tagIds) {
    await prisma.$executeRaw`
      INSERT INTO folder_tags (id, user_id, folder_key, tag_id, created_at)
      VALUES (${randomUUID()}, ${userId}, ${folderKey}, ${tagId}, NOW())
      ON CONFLICT (user_id, folder_key, tag_id) DO NOTHING
    `;
  }
}

export async function setFolderTagsHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const folderKey = params?.id ? decodeURIComponent(params.id) : "";
  if (!folderKey)
    return errorJson("FOLDER_NOT_FOUND", "Folder not found.", 404);

  const body = z
    .object({
      tagIds: z.array(z.string().min(1)).max(50),
    })
    .parse(await request.json());

  const allowed = await assertFolderTagAccess(user.id, folderKey);
  if (!allowed) return errorJson("FOLDER_NOT_FOUND", "Folder not found.", 404);

  const tags = await prisma.tag.findMany({
    where: { userId: user.id, id: { in: body.tagIds } },
  });
  if (tags.length !== body.tagIds.length) {
    return errorJson(
      "VALIDATION_ERROR",
      "One or more tags were not found.",
      400,
    );
  }

  await replaceFolderTags(user.id, folderKey, body.tagIds);
  const saved = await listFolderTagsForUser(user.id, folderKey);
  return json({ tags: saved });
}

export async function listFolderTagsHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const folderKey = params?.id ? decodeURIComponent(params.id) : "";
  if (!folderKey)
    return errorJson("FOLDER_NOT_FOUND", "Folder not found.", 404);

  const allowed = await assertFolderTagAccess(user.id, folderKey);
  if (!allowed) return errorJson("FOLDER_NOT_FOUND", "Folder not found.", 404);

  const tags = await listFolderTagsForUser(user.id, folderKey);
  return json({ tags });
}
