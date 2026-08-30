import { z } from "zod";
import { prisma } from "@/server/config/prisma";
import { requireAuthUser } from "@/server/http/auth";
import { errorJson, json } from "@/server/http/responses";
import { serializeFile } from "@/server/lib/file-serialize";

function serializeTag(tag: {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
  _count?: { fileTags: number };
}) {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
    createdAt: tag.createdAt.toISOString(),
    updatedAt: tag.updatedAt.toISOString(),
    fileCount: tag._count?.fileTags ?? undefined,
  };
}

export async function listTagsHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const tags = await prisma.tag.findMany({
    where: { userId: user.id },
    include: { _count: { select: { fileTags: true } } },
    orderBy: { name: "asc" },
  });
  return json({ tags: tags.map(serializeTag) });
}

export async function createTagHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const body = z
    .object({
      name: z.string().trim().min(1).max(64),
      color: z.string().trim().min(1).max(64).optional(),
    })
    .parse(await request.json());

  const existing = await prisma.tag.findUnique({
    where: { userId_name: { userId: user.id, name: body.name } },
  });
  if (existing) {
    return errorJson("TAG_EXISTS", "A tag with this name already exists.", 409);
  }

  const tag = await prisma.tag.create({
    data: {
      userId: user.id,
      name: body.name,
      color: body.color ?? "text-blue-500",
    },
  });
  return json({ tag: serializeTag(tag) }, 201);
}

export async function deleteTagHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const id = params?.id;
  if (!id) return errorJson("NOT_FOUND", "Tag not found.", 404);
  const result = await prisma.tag.deleteMany({
    where: { id, userId: user.id },
  });
  if (result.count === 0) {
    return errorJson("NOT_FOUND", "Tag not found.", 404);
  }
  return json({ status: "ok" });
}

export async function setFileTagsHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const fileId = params?.id;
  if (!fileId) return errorJson("FILE_NOT_FOUND", "File not found.", 404);

  const body = z
    .object({
      tagIds: z.array(z.string().min(1)).max(50),
    })
    .parse(await request.json());

  const file = await prisma.file.findFirst({
    where: {
      id: fileId,
      userId: user.id,
      status: "active",
      deletedAt: null,
    },
  });
  if (!file) return errorJson("FILE_NOT_FOUND", "File not found.", 404);

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

  await prisma.$transaction([
    prisma.fileTag.deleteMany({ where: { fileId } }),
    ...(body.tagIds.length > 0
      ? [
          prisma.fileTag.createMany({
            data: body.tagIds.map((tagId) => ({ fileId, tagId })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);

  const updated = await prisma.file.findFirstOrThrow({
    where: { id: fileId },
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
  });

  return json({
    file: serializeFile({
      ...updated,
      tags: updated.fileTags.map((ft) => ft.tag),
    }),
  });
}

export async function listFileTagsHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const fileId = params?.id;
  if (!fileId) return errorJson("FILE_NOT_FOUND", "File not found.", 404);
  const file = await prisma.file.findFirst({
    where: { id: fileId, userId: user.id },
  });
  if (!file) return errorJson("FILE_NOT_FOUND", "File not found.", 404);
  const fileTags = await prisma.fileTag.findMany({
    where: { fileId },
    include: { tag: true },
    orderBy: { createdAt: "asc" },
  });
  return json({ tags: fileTags.map((ft) => serializeTag(ft.tag)) });
}
