import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { prisma } from "@/server/config/prisma";
import { requireAuthUser } from "@/server/http/auth";
import { errorJson, json } from "@/server/http/responses";

const MAX_NAME_LENGTH = 100;
const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;

const colorSchema = z
  .string()
  .regex(/^(#[0-9a-fA-F]{6}|text-[a-z]+-[0-9]+)$/)
  .max(64);

const thumbnailDataUrlSchema = z
  .string()
  .max(7_000_000)
  .refine(
    (value) =>
      /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(value) &&
      estimateDataUrlBytes(value) <= MAX_THUMBNAIL_BYTES,
    {
      message:
        "Thumbnail must be a PNG, JPG, or WEBP image of at most 5MB.",
    },
  );

function estimateDataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return Number.POSITIVE_INFINITY;
  const base64 = dataUrl.slice(comma + 1).replace(/\s/g, "");
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

function serializeVirtualFolder(folder: {
  id: string;
  name: string;
  color: string;
  thumbnailDataUrl?: string | null;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { items: number; children: number };
}) {
  return {
    id: folder.id,
    name: folder.name,
    color: folder.color,
    thumbnailDataUrl: folder.thumbnailDataUrl ?? null,
    parentId: folder.parentId,
    createdAt: folder.createdAt.toISOString(),
    updatedAt: folder.updatedAt.toISOString(),
    itemCount: folder._count?.items,
    childCount: folder._count?.children,
  };
}

function serializeVirtualFolderItem(item: {
  id: string;
  virtualFolderId: string;
  connectedAccountId: string;
  providerFileId: string;
  providerFolderId: string | null;
  name: string;
  mimeType: string;
  sizeBytes: bigint;
  kind: string;
  createdAt: Date;
  updatedAt: Date;
  connectedAccount?: {
    id: string;
    email: string;
    provider: string;
    displayName: string | null;
  };
}) {
  return {
    id: item.id,
    virtualFolderId: item.virtualFolderId,
    connectedAccountId: item.connectedAccountId,
    providerFileId: item.providerFileId,
    providerFolderId: item.providerFolderId,
    name: item.name,
    mimeType: item.mimeType,
    sizeBytes: item.sizeBytes.toString(),
    kind: item.kind,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    connectedAccount: item.connectedAccount ?? undefined,
  };
}

async function getOwnedVirtualFolder(userId: string, folderId: string) {
  const folder = await prisma.virtualFolder.findFirst({
    where: { id: folderId, userId },
  });
  if (!folder) {
    return errorJson("FOLDER_NOT_FOUND", "Virtual folder not found.", 404);
  }
  return folder;
}

export async function listVirtualFoldersHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  const folders = await prisma.virtualFolder.findMany({
    where: { userId: user.id },
    include: {
      _count: { select: { items: true, children: true } },
    },
    orderBy: [{ parentId: "asc" }, { name: "asc" }],
  });

  return json({ folders: folders.map(serializeVirtualFolder) });
}

export async function getVirtualFolderHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const id = params?.id;
  if (!id) return errorJson("FOLDER_NOT_FOUND", "Virtual folder not found.", 404);

  const folder = await prisma.virtualFolder.findFirst({
    where: { id, userId: user.id },
    include: {
      _count: { select: { items: true, children: true } },
    },
  });
  if (!folder) {
    return errorJson("FOLDER_NOT_FOUND", "Virtual folder not found.", 404);
  }
  return json({ folder: serializeVirtualFolder(folder) });
}

export async function createVirtualFolderHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  const body = z
    .object({
      name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
      color: colorSchema.optional(),
      parentId: z.string().nullable().optional(),
      thumbnailDataUrl: thumbnailDataUrlSchema.nullable().optional(),
    })
    .parse(await request.json());

  if (body.parentId) {
    const parent = await getOwnedVirtualFolder(user.id, body.parentId);
    if (parent instanceof Response) return parent;
  }

  const folder = await prisma.virtualFolder.create({
    data: {
      userId: user.id,
      name: body.name,
      color: body.color ?? "#1e9df1",
      parentId: body.parentId ?? null,
      thumbnailDataUrl: body.thumbnailDataUrl ?? null,
    },
    include: {
      _count: { select: { items: true, children: true } },
    },
  });

  return json({ folder: serializeVirtualFolder(folder) }, 201);
}

export async function updateVirtualFolderHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const id = params?.id;
  if (!id) return errorJson("FOLDER_NOT_FOUND", "Virtual folder not found.", 404);

  const body = z
    .object({
      name: z.string().trim().min(1).max(MAX_NAME_LENGTH).optional(),
      color: colorSchema.optional(),
      parentId: z.string().nullable().optional(),
      thumbnailDataUrl: thumbnailDataUrlSchema.nullable().optional(),
    })
    .parse(await request.json());

  const existing = await getOwnedVirtualFolder(user.id, id);
  if (existing instanceof Response) return existing;

  if (body.parentId) {
    if (body.parentId === id) {
      return errorJson(
        "VALIDATION_ERROR",
        "A virtual folder cannot be its own parent.",
        400,
      );
    }
    const parent = await getOwnedVirtualFolder(user.id, body.parentId);
    if (parent instanceof Response) return parent;
  }

  const folder = await prisma.virtualFolder.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.color !== undefined ? { color: body.color } : {}),
      ...(body.parentId !== undefined ? { parentId: body.parentId } : {}),
      ...(body.thumbnailDataUrl !== undefined
        ? { thumbnailDataUrl: body.thumbnailDataUrl }
        : {}),
    },
    include: {
      _count: { select: { items: true, children: true } },
    },
  });

  return json({ folder: serializeVirtualFolder(folder) });
}

export async function deleteVirtualFolderHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const id = params?.id;
  if (!id) return errorJson("FOLDER_NOT_FOUND", "Virtual folder not found.", 404);

  const result = await prisma.virtualFolder.deleteMany({
    where: { id, userId: user.id },
  });
  if (result.count === 0) {
    return errorJson("FOLDER_NOT_FOUND", "Virtual folder not found.", 404);
  }
  return json({ status: "ok" });
}

export async function listVirtualFolderItemsHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const folderId = params?.id;
  if (!folderId) {
    return errorJson("FOLDER_NOT_FOUND", "Virtual folder not found.", 404);
  }

  const folder = await getOwnedVirtualFolder(user.id, folderId);
  if (folder instanceof Response) return folder;

  const items = await prisma.virtualFolderItem.findMany({
    where: { virtualFolderId: folderId },
    include: {
      connectedAccount: {
        select: {
          id: true,
          email: true,
          provider: true,
          displayName: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return json({ items: items.map(serializeVirtualFolderItem) });
}

export async function addVirtualFolderItemHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const folderId = params?.id;
  if (!folderId) {
    return errorJson("FOLDER_NOT_FOUND", "Virtual folder not found.", 404);
  }

  const body = z
    .object({
      connectedAccountId: z.string().min(1),
      providerFileId: z.string().trim().min(1).max(512),
      providerFolderId: z.string().trim().max(512).optional(),
      name: z.string().trim().min(1).max(255),
      mimeType: z.string().trim().max(191).optional(),
      sizeBytes: z.union([z.string(), z.number(), z.bigint()]).optional(),
      kind: z.enum(["file", "folder"]).optional(),
    })
    .parse(await request.json());

  const folder = await getOwnedVirtualFolder(user.id, folderId);
  if (folder instanceof Response) return folder;

  const account = await prisma.connectedAccount.findFirst({
    where: {
      id: body.connectedAccountId,
      userId: user.id,
      status: "connected",
    },
  });
  if (!account) {
    return errorJson("ACCOUNT_NOT_FOUND", "Connected account not found.", 404);
  }

  const sizeBytes =
    body.sizeBytes === undefined
      ? BigInt(0)
      : typeof body.sizeBytes === "bigint"
        ? body.sizeBytes
        : BigInt(body.sizeBytes);

  try {
    const item = await prisma.virtualFolderItem.create({
      data: {
        virtualFolderId: folderId,
        connectedAccountId: body.connectedAccountId,
        providerFileId: body.providerFileId,
        providerFolderId: body.providerFolderId ?? null,
        name: body.name,
        mimeType: body.mimeType ?? "application/octet-stream",
        sizeBytes,
        kind: body.kind ?? "file",
      },
      include: {
        connectedAccount: {
          select: {
            id: true,
            email: true,
            provider: true,
            displayName: true,
          },
        },
      },
    });
    return json({ item: serializeVirtualFolderItem(item) }, 201);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return errorJson(
        "ITEM_EXISTS",
        "This file is already in the virtual folder.",
        409,
      );
    }
    throw error;
  }
}

export async function removeVirtualFolderItemHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const itemId = params?.itemId;
  if (!itemId) return errorJson("ITEM_NOT_FOUND", "Item not found.", 404);

  const item = await prisma.virtualFolderItem.findFirst({
    where: { id: itemId, virtualFolder: { userId: user.id } },
  });
  if (!item) {
    return errorJson("ITEM_NOT_FOUND", "Item not found.", 404);
  }

  await prisma.virtualFolderItem.delete({ where: { id: itemId } });
  return json({ status: "ok" });
}
