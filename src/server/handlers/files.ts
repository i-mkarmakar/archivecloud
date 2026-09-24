import { PassThrough, Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { z } from "zod";
import { env } from "@/server/config/env";
import { prisma } from "@/server/config/prisma";
import { requireAuthUser } from "@/server/http/auth";
import { errorJson, json } from "@/server/http/responses";
import { getAccessibleFile } from "@/server/lib/file-access";
import { serializeFile, touchFileAccess } from "@/server/lib/file-serialize";
import { streamProviderFileResponse } from "@/server/modules/files/stream-file";
import {
  fetchGoogleDriveFileMedia,
  streamGoogleDriveThumbnailResponse,
} from "@/server/modules/providers/google/drive-stream";
import {
  getGoogleDriveWebLinks,
  makeGoogleDriveFilePublicReader,
  syncGoogleAppFolderFiles,
  syncGoogleQuota,
} from "@/server/modules/providers/google/google.service";
import {
  deleteProviderFile,
  renameProviderFile,
} from "@/server/modules/providers/operations";
import { createAuditLog } from "@/server/utils/audit";
import {
  decryptText,
  encryptText,
  hashToken,
  randomToken,
} from "@/server/utils/crypto";

const SHARE_LINK_TTL_MS = 30 * 24 * 60 * 60_000;

function sharePublicUrl(token: string) {
  return `${env.APP_URL}/public/files/${token}`;
}

function decryptShareToken(encrypted: string | null | undefined) {
  if (!encrypted) return null;
  try {
    return decryptText(encrypted);
  } catch {
    return null;
  }
}

function parseLinkedFileId(fileId: string) {
  let decoded = fileId;
  try {
    decoded = decodeURIComponent(fileId);
  } catch {
    decoded = fileId;
  }
  if (!decoded.startsWith("linked:")) return null;
  const rest = decoded.slice("linked:".length);
  const colon = rest.indexOf(":");
  if (colon <= 0) return null;
  const accountId = rest.slice(0, colon).trim();
  const providerFileId = rest.slice(colon + 1).trim();
  if (!accountId || !providerFileId) return null;
  return { accountId, providerFileId };
}

function parseSizeBytes(
  value: string | number | bigint | null | undefined,
): bigint {
  if (value === undefined || value === null || value === "") return BigInt(0);
  if (typeof value === "bigint") return value < BigInt(0) ? BigInt(0) : value;
  if (typeof value === "number" && Number.isFinite(value)) {
    return BigInt(Math.max(0, Math.trunc(value)));
  }
  const cleaned = String(value).trim();
  if (/^\d+$/.test(cleaned)) return BigInt(cleaned);
  return BigInt(0);
}

async function resolveShareableFile(
  userId: string,
  fileIdParam: string,
  meta?: {
    name?: string;
    mimeType?: string;
    sizeBytes?: string | number | null;
  },
  options?: { createIfMissing?: boolean },
) {
  let decoded = fileIdParam;
  try {
    decoded = decodeURIComponent(fileIdParam);
  } catch {
    decoded = fileIdParam;
  }
  const linked = parseLinkedFileId(decoded);
  const createIfMissing = options?.createIfMissing ?? false;

  if (linked) {
    const account = await prisma.connectedAccount.findFirst({
      where: {
        id: linked.accountId,
        userId,
        status: "connected",
      },
    });
    if (!account) return null;

    const existing = await prisma.file.findFirst({
      where: {
        userId,
        connectedAccountId: linked.accountId,
        providerFileId: linked.providerFileId,
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      if (existing.status !== "active" || existing.deletedAt) {
        return prisma.file.update({
          where: { id: existing.id },
          data: {
            status: "active",
            deletedAt: null,
            ...(meta?.name ? { name: meta.name.trim().slice(0, 255) } : {}),
            ...(meta?.mimeType
              ? { mimeType: meta.mimeType.slice(0, 191) }
              : {}),
          },
        });
      }
      return existing;
    }

    if (!createIfMissing) {
      return {
        id: decoded,
        name: meta?.name?.trim() || "Shared file",
        virtual: true as const,
      };
    }

    return prisma.file.create({
      data: {
        userId,
        connectedAccountId: linked.accountId,
        provider: account.provider,
        providerFileId: linked.providerFileId.slice(0, 191),
        name: (meta?.name?.trim() || "Shared file").slice(0, 255),
        mimeType: (meta?.mimeType || "application/octet-stream").slice(0, 191),
        sizeBytes: parseSizeBytes(meta?.sizeBytes),
        status: "active",
      },
    });
  }

  return prisma.file.findFirst({
    where: {
      id: decoded,
      userId,
      status: "active",
      deletedAt: null,
    },
  });
}

const batchFileSchema = z.object({
  fileIds: z.array(z.string().min(1)).min(1).max(100),
});

const typeFilters: Record<string, string[]> = {
  image: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
  ],
  video: [
    "video/mp4",
    "video/mpeg",
    "video/ogg",
    "video/quicktime",
    "video/webm",
  ],
  pdf: ["application/pdf"],
  doc: [
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ],
  archive: [
    "application/zip",
    "application/x-rar-compressed",
    "application/x-tar",
    "application/x-7z-compressed",
  ],
};

export async function previewFileByTokenHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const token = params?.token;
  if (!token)
    return errorJson("PREVIEW_NOT_FOUND", "Preview token not found.", 404);
  const preview = await prisma.filePreviewToken.findFirst({
    where: { tokenHash: hashToken(token), expiresAt: { gt: new Date() } },
    include: { file: { include: { connectedAccount: true } } },
  });
  if (preview?.file.status !== "active")
    return errorJson("PREVIEW_NOT_FOUND", "Preview token not found.", 404);
  return streamProviderFileResponse(
    preview.file,
    request.headers.get("range") ?? undefined,
    { disposition: "inline" },
  );
}

export async function listFilesHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const url = new URL(request.url);
  const query = z
    .object({
      folderId: z.string().optional(),
      q: z.string().trim().max(255).optional(),
      kind: z.enum(["image", "video", "pdf", "doc", "archive"]).optional(),
      accountId: z.string().optional(),
      minSize: z.coerce.number().optional(),
      maxSize: z.coerce.number().optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      view: z.enum(["starred", "archived", "recent"]).optional(),
      tagId: z.string().optional(),
      sort: z
        .enum([
          "created_desc",
          "created_asc",
          "name_asc",
          "name_desc",
          "size_desc",
          "updated_desc",
        ])
        .optional(),
      limit: z.coerce.number().int().min(1).max(200).optional(),
      cursor: z.string().min(1).optional(),
    })
    .parse(Object.fromEntries(url.searchParams));

  const where: Record<string, unknown> = {
    userId: user.id,
    status: "active",
    deletedAt: null,
    ...(query.folderId ? { folderId: query.folderId } : {}),
    ...(query.q ? { name: { contains: query.q } } : {}),
    ...(query.accountId ? { connectedAccountId: query.accountId } : {}),
    ...(query.kind ? { mimeType: { in: typeFilters[query.kind] || [] } } : {}),
    ...(query.tagId ? { fileTags: { some: { tagId: query.tagId } } } : {}),
    ...(query.minSize !== undefined || query.maxSize !== undefined
      ? {
          sizeBytes: {
            ...(query.minSize !== undefined
              ? { gte: BigInt(query.minSize) }
              : {}),
            ...(query.maxSize !== undefined
              ? { lte: BigInt(query.maxSize) }
              : {}),
          },
        }
      : {}),
    ...(query.startDate || query.endDate
      ? {
          createdAt: {
            ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
            ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
          },
        }
      : {}),
  };

  if (query.view === "starred") {
    where.isStarred = true;
  } else if (query.view === "archived") {
    where.isArchived = true;
  } else if (query.view === "recent") {
    where.isArchived = false;
    where.lastAccessedAt = { not: null };
  } else if (!query.folderId) {
    where.isArchived = false;
  }

  const orderBy =
    query.sort === "created_asc"
      ? [{ createdAt: "asc" as const }, { id: "asc" as const }]
      : query.sort === "name_asc"
        ? [{ name: "asc" as const }, { id: "asc" as const }]
        : query.sort === "name_desc"
          ? [{ name: "desc" as const }, { id: "desc" as const }]
          : query.sort === "size_desc"
            ? [{ sizeBytes: "desc" as const }, { id: "desc" as const }]
            : query.sort === "updated_desc"
              ? [{ updatedAt: "desc" as const }, { id: "desc" as const }]
              : query.view === "starred"
                ? [
                    { starredAt: "desc" as const },
                    { updatedAt: "desc" as const },
                    { id: "desc" as const },
                  ]
                : query.view === "archived"
                  ? [
                      { archivedAt: "desc" as const },
                      { updatedAt: "desc" as const },
                      { id: "desc" as const },
                    ]
                  : query.view === "recent"
                    ? [
                        { lastAccessedAt: "desc" as const },
                        { updatedAt: "desc" as const },
                        { id: "desc" as const },
                      ]
                    : [{ createdAt: "desc" as const }, { id: "desc" as const }];

  const limit = query.limit ?? 40;

  const files = await prisma.file.findMany({
    where,
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
    orderBy,
    take: limit + 1,
    ...(query.cursor
      ? {
          cursor: { id: query.cursor },
          skip: 1,
        }
      : {}),
  });

  const hasMore = files.length > limit;
  const page = hasMore ? files.slice(0, limit) : files;
  const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null;

  return json({
    files: page.map((file) =>
      serializeFile({
        ...file,
        tags: file.fileTags.map((ft) => ft.tag),
      }),
    ),
    nextCursor,
  });
}

export async function batchMoveFilesHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const body = batchFileSchema
    .extend({ folderId: z.string().nullable().optional() })
    .parse(await request.json());
  if (body.folderId)
    await prisma.folder.findFirstOrThrow({
      where: { id: body.folderId, userId: user.id, deletedAt: null },
    });
  const result = await prisma.file.updateMany({
    where: { id: { in: body.fileIds }, userId: user.id, status: "active" },
    data: { folderId: body.folderId ?? null },
  });
  await createAuditLog(user.id, "MOVE_FILES", "file", undefined, {
    count: result.count,
    folderId: body.folderId,
  });
  return json({ status: "ok", moved: result.count });
}

export async function batchUpdateFileMetadataHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const body = batchFileSchema
    .extend({
      isStarred: z.boolean().optional(),
      isArchived: z.boolean().optional(),
    })
    .refine(
      (value) =>
        value.isStarred !== undefined || value.isArchived !== undefined,
      { message: "isStarred or isArchived required." },
    )
    .parse(await request.json());

  const now = new Date();
  const data: Record<string, unknown> = {};
  if (body.isStarred !== undefined) {
    data.isStarred = body.isStarred;
    data.starredAt = body.isStarred ? now : null;
  }
  if (body.isArchived !== undefined) {
    data.isArchived = body.isArchived;
    data.archivedAt = body.isArchived ? now : null;
  }

  const result = await prisma.file.updateMany({
    where: { id: { in: body.fileIds }, userId: user.id, status: "active" },
    data,
  });

  if (body.isStarred !== undefined) {
    await createAuditLog(user.id, "UPDATE_FILE_STAR", "file", undefined, {
      count: result.count,
      isStarred: body.isStarred,
    });
  }
  if (body.isArchived !== undefined) {
    await createAuditLog(user.id, "UPDATE_FILE_ARCHIVE", "file", undefined, {
      count: result.count,
      isArchived: body.isArchived,
    });
  }

  return json({ status: "ok", updated: result.count });
}

export async function batchTrashFilesHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const body = batchFileSchema.parse(await request.json());
  const files = await prisma.file.findMany({
    where: { id: { in: body.fileIds }, userId: user.id, status: "active" },
  });
  const result = await prisma.file.updateMany({
    where: { id: { in: body.fileIds }, userId: user.id, status: "active" },
    data: { status: "deleted", deletedAt: new Date() },
  });
  for (const f of files) {
    await createAuditLog(user.id, "TRASH_FILE", "file", f.id, { name: f.name });
  }
  return json({ status: "ok", deleted: result.count });
}

export async function listTrashFilesHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const url = new URL(request.url);
  const query = z
    .object({
      q: z.string().trim().max(255).optional(),
      limit: z.coerce.number().int().min(1).max(100).default(40),
      cursor: z.string().min(1).optional(),
    })
    .parse(Object.fromEntries(url.searchParams));
  const files = await prisma.file.findMany({
    where: {
      userId: user.id,
      status: "deleted",
      ...(query.q ? { name: { contains: query.q } } : {}),
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
    },
    orderBy: [{ deletedAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    ...(query.cursor
      ? {
          cursor: { id: query.cursor },
          skip: 1,
        }
      : {}),
  });
  const hasMore = files.length > query.limit;
  const page = hasMore ? files.slice(0, query.limit) : files;
  const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null;
  return json({
    files: page.map((file) => ({
      ...file,
      sizeBytes: file.sizeBytes.toString(),
    })),
    nextCursor,
  });
}

export async function batchRestoreFilesHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const body = batchFileSchema.parse(await request.json());
  const files = await prisma.file.findMany({
    where: { id: { in: body.fileIds }, userId: user.id, status: "deleted" },
  });
  const result = await prisma.file.updateMany({
    where: { id: { in: body.fileIds }, userId: user.id, status: "deleted" },
    data: { status: "active", deletedAt: null },
  });
  for (const f of files) {
    await createAuditLog(user.id, "RESTORE_FILE", "file", f.id, {
      name: f.name,
    });
  }
  return json({ status: "ok", restored: result.count });
}

export async function batchPermanentDeleteFilesHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const body = batchFileSchema.parse(await request.json());
  const files = await prisma.file.findMany({
    where: { id: { in: body.fileIds }, userId: user.id, status: "deleted" },
    include: { connectedAccount: true },
  });
  const deletedIds: string[] = [];
  const syncedAccountIds = new Set<string>();
  const failed: Array<{ fileId: string; message: string }> = [];

  for (const file of files) {
    try {
      await deleteProviderFile({
        account: file.connectedAccount,
        providerFileId: file.providerFileId,
      });
      deletedIds.push(file.id);
      syncedAccountIds.add(file.connectedAccountId);
      await createAuditLog(user.id, "PERMANENT_DELETE_FILE", "file", file.id, {
        name: file.name,
      });
    } catch (error) {
      failed.push({
        fileId: file.id,
        message: error instanceof Error ? error.message : "Delete failed",
      });
    }
  }

  if (deletedIds.length > 0) {
    await prisma.file.deleteMany({
      where: { id: { in: deletedIds }, userId: user.id },
    });
  }

  for (const accountId of syncedAccountIds) {
    await syncGoogleQuota(accountId).catch(() => undefined);
  }

  if (deletedIds.length === 0 && failed.length > 0) {
    return json(
      {
        code: "FILES_DELETE_FAILED",
        message: "No files were permanently deleted.",
        deleted: 0,
        failed,
      },
      400,
    );
  }
  return json({ status: "ok", deleted: deletedIds.length, failed });
}

export async function listSharedLinksHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const shares = await prisma.fileShare.findMany({
    where: {
      userId: user.id,
      enabled: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: {
      file: {
        include: {
          connectedAccount: {
            select: {
              email: true,
              provider: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          folder: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return json({
    shares: shares
      .filter((share) => share.file.status === "active")
      .map((share) => ({
        id: share.id,
        url: null as string | null,
        createdAt: share.createdAt.toISOString(),
        expiresAt: share.expiresAt?.toISOString() ?? null,
        file: { ...share.file, sizeBytes: share.file.sizeBytes.toString() },
      })),
  });
}

export async function syncGoogleFilesHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const body = z
    .object({ connectedAccountId: z.string().min(1).optional() })
    .parse(await request.json().catch(() => ({})));
  const accounts = await prisma.connectedAccount.findMany({
    where: {
      userId: user.id,
      provider: "google_drive",
      status: "connected",
      ...(body.connectedAccountId ? { id: body.connectedAccountId } : {}),
    },
    select: { id: true },
  });
  const results = [];
  for (const account of accounts)
    results.push(await syncGoogleAppFolderFiles(account.id, user.id));
  return json({ status: "ok", results });
}

export async function getFileHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const fileId = params?.id;
  if (!fileId) return errorJson("FILE_NOT_FOUND", "File not found.", 404);
  const file = await getAccessibleFile(user.id, fileId, {
    includeFolder: true,
  });
  if (!file) return errorJson("FILE_NOT_FOUND", "File not found.", 404);
  return json({ file: serializeFile(file) });
}

export async function updateFileHandler(
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
      name: z.string().min(1).max(255).optional(),
      folderId: z.string().nullable().optional(),
      isStarred: z.boolean().optional(),
      isArchived: z.boolean().optional(),
    })
    .parse(await request.json());
  const file = await prisma.file.findFirstOrThrow({
    where: { id: fileId, userId: user.id },
    include: { connectedAccount: true },
  });
  if (body.folderId)
    await prisma.folder.findFirstOrThrow({
      where: { id: body.folderId, userId: user.id, deletedAt: null },
    });
  if (body.name) {
    try {
      await renameProviderFile({
        account: file.connectedAccount,
        providerFileId: file.providerFileId,
        newName: body.name,
      });
    } catch (error) {
      console.error(error);
      return errorJson(
        "RENAME_FAILED",
        "Could not rename the file. Please try again.",
        400,
      );
    }
  }
  const now = new Date();
  const updated = await prisma.file.update({
    where: { id: file.id },
    data: {
      ...(body.name ? { name: body.name } : {}),
      ...(body.folderId !== undefined ? { folderId: body.folderId } : {}),
      ...(body.isStarred !== undefined
        ? { isStarred: body.isStarred, starredAt: body.isStarred ? now : null }
        : {}),
      ...(body.isArchived !== undefined
        ? {
            isArchived: body.isArchived,
            archivedAt: body.isArchived ? now : null,
          }
        : {}),
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
    },
  });
  await createAuditLog(user.id, "UPDATE_FILE", "file", updated.id, {
    name: updated.name,
    updates: body,
  });
  return json({
    file: serializeFile(updated),
  });
}

export async function getFileShareHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const fileId = params?.id;
  if (!fileId) return errorJson("FILE_NOT_FOUND", "File not found.", 404);

  const url = new URL(request.url);
  const sizeParam = url.searchParams.get("sizeBytes");
  const file = await resolveShareableFile(
    user.id,
    fileId,
    {
      name: url.searchParams.get("name") ?? undefined,
      mimeType: url.searchParams.get("mimeType") ?? undefined,
      sizeBytes: sizeParam == null || sizeParam === "" ? undefined : sizeParam,
    },
    { createIfMissing: false },
  );
  if (!file) return errorJson("FILE_NOT_FOUND", "File not found.", 404);

  if ("virtual" in file && file.virtual) {
    return json({
      status: "none" as const,
      fileId: null,
      fileName: file.name,
      shareId: null,
      enabled: false,
      url: null,
    });
  }

  const share = await prisma.fileShare.findFirst({
    where: {
      fileId: file.id,
      userId: user.id,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
  });

  if (!share) {
    return json({
      status: "none" as const,
      fileId: file.id,
      fileName: file.name,
      shareId: null,
      enabled: false,
      url: null,
    });
  }

  const token = decryptShareToken(share.tokenEncrypted);
  return json({
    status: share.enabled ? ("active" as const) : ("disabled" as const),
    fileId: file.id,
    fileName: file.name,
    shareId: share.id,
    enabled: share.enabled,
    url: token ? sharePublicUrl(token) : null,
    needsRegenerate: !token,
    expiresAt: share.expiresAt?.toISOString() ?? null,
  });
}

export async function shareFileHandler(
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
      rotate: z.boolean().optional(),
      name: z.string().trim().min(1).max(255).optional(),
      mimeType: z.string().trim().max(191).optional(),
      sizeBytes: z.union([z.string(), z.number()]).optional(),
    })
    .parse(await request.json().catch(() => ({})));

  const file = await resolveShareableFile(
    user.id,
    fileId,
    {
      name: body.name,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
    },
    { createIfMissing: true },
  );
  if (!file || ("virtual" in file && file.virtual)) {
    return errorJson("FILE_NOT_FOUND", "File not found.", 404);
  }

  const existingShare = await prisma.fileShare.findFirst({
    where: {
      fileId: file.id,
      userId: user.id,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingShare && !body.rotate) {
    const token = decryptShareToken(existingShare.tokenEncrypted);
    if (token && existingShare.enabled) {
      return json({
        shareId: existingShare.id,
        fileId: file.id,
        url: sharePublicUrl(token),
        alreadyShared: true,
        enabled: true,
        status: "active" as const,
      });
    }
    if (token && !existingShare.enabled) {
      return json({
        shareId: existingShare.id,
        fileId: file.id,
        url: sharePublicUrl(token),
        alreadyShared: true,
        enabled: false,
        status: "disabled" as const,
      });
    }
  }

  const token = randomToken(32);
  const tokenHash = hashToken(token);
  const tokenEncrypted = encryptText(token);
  const expiresAt = new Date(Date.now() + SHARE_LINK_TTL_MS);
  let shareId: string;
  if (!existingShare) {
    const share = await prisma.fileShare.create({
      data: {
        fileId: file.id,
        userId: user.id,
        tokenHash,
        tokenEncrypted,
        enabled: true,
        expiresAt,
      },
    });
    shareId = share.id;
  } else {
    const share = await prisma.fileShare.update({
      where: { id: existingShare.id },
      data: {
        tokenHash,
        tokenEncrypted,
        enabled: true,
        expiresAt,
      },
    });
    shareId = share.id;
  }
  return json(
    {
      url: sharePublicUrl(token),
      shareId,
      fileId: file.id,
      alreadyShared: Boolean(existingShare),
      enabled: true,
      status: "active" as const,
      expiresAt: expiresAt.toISOString(),
    },
    existingShare ? 200 : 201,
  );
}

export async function setFileShareEnabledHandler(
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
      enabled: z.boolean(),
      name: z.string().trim().min(1).max(255).optional(),
      mimeType: z.string().trim().max(191).optional(),
      sizeBytes: z.union([z.string(), z.number()]).optional(),
    })
    .parse(await request.json());

  const file = await resolveShareableFile(
    user.id,
    fileId,
    {
      name: body.name,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
    },
    { createIfMissing: true },
  );
  if (!file || ("virtual" in file && file.virtual)) {
    return errorJson("FILE_NOT_FOUND", "File not found.", 404);
  }

  const share = await prisma.fileShare.findFirst({
    where: {
      fileId: file.id,
      userId: user.id,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
  });
  if (!share) {
    return errorJson("SHARE_NOT_FOUND", "No public link exists yet.", 404);
  }

  const updated = await prisma.fileShare.update({
    where: { id: share.id },
    data: { enabled: body.enabled },
  });
  const token = decryptShareToken(updated.tokenEncrypted);

  return json({
    status: updated.enabled ? ("active" as const) : ("disabled" as const),
    shareId: updated.id,
    fileId: file.id,
    enabled: updated.enabled,
    url: token ? sharePublicUrl(token) : null,
  });
}

export async function publicPermissionHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const fileId = params?.id;
  if (!fileId) return errorJson("FILE_NOT_FOUND", "File not found.", 404);
  const file = await prisma.file.findFirstOrThrow({
    where: { id: fileId, userId: user.id },
    include: { connectedAccount: true },
  });
  if (file.provider !== "google_drive")
    return errorJson(
      "UNSUPPORTED_PROVIDER",
      "Only Google Drive files can be made public.",
      400,
    );
  try {
    const links = await makeGoogleDriveFilePublicReader(
      file.connectedAccount,
      file.providerFileId,
    );
    return json({
      status: "ok",
      url: links.webViewLink ?? links.webContentLink,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update Google Drive permissions.";
    return errorJson("GOOGLE_API_ERROR", message, 500);
  }
}

export async function unshareFileHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const fileId = params?.id;
  if (!fileId) return errorJson("FILE_NOT_FOUND", "File not found.", 404);
  const file = await resolveShareableFile(user.id, fileId, undefined, {
    createIfMissing: false,
  });
  if (!file || ("virtual" in file && file.virtual)) {
    return errorJson("FILE_NOT_FOUND", "File not found.", 404);
  }
  await prisma.fileShare.updateMany({
    where: { fileId: file.id, userId: user.id, enabled: true },
    data: { enabled: false },
  });
  return json({ status: "ok" });
}

export async function createPreviewTokenHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const fileId = params?.id;
  if (!fileId) return errorJson("FILE_NOT_FOUND", "File not found.", 404);
  const file = await getAccessibleFile(user.id, fileId, { activeOnly: true });
  if (!file) return errorJson("FILE_NOT_FOUND", "File not found.", 404);
  await touchFileAccess(user.id, file.id, "PREVIEW_FILE");
  const token = randomToken(32);
  await prisma.filePreviewToken.create({
    data: {
      fileId: file.id,
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 10 * 60_000),
    },
  });
  const path = `/files/preview/${token}`;
  const origin = new URL(request.url).origin;
  return json({ path, url: `${origin}${path}` }, 201);
}

export async function getViewUrlHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const fileId = params?.id;
  if (!fileId) return errorJson("FILE_NOT_FOUND", "File not found.", 404);
  const file = await getAccessibleFile(user.id, fileId);
  if (!file) return errorJson("FILE_NOT_FOUND", "File not found.", 404);
  const links = await getGoogleDriveWebLinks(
    file.connectedAccount,
    file.providerFileId,
  );
  return json({
    url: links.webViewLink ?? links.webContentLink,
  });
}

export async function downloadFileHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const fileId = params?.id;
  if (!fileId) return errorJson("FILE_NOT_FOUND", "File not found.", 404);
  const file = await getAccessibleFile(user.id, fileId);
  if (!file) return errorJson("FILE_NOT_FOUND", "File not found.", 404);
  await touchFileAccess(user.id, file.id, "DOWNLOAD_FILE");
  return streamProviderFileResponse(
    file,
    request.headers.get("range") ?? undefined,
    { disposition: "attachment" },
  );
}

export async function thumbnailFileHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const fileId = params?.id;
  if (!fileId) return errorJson("FILE_NOT_FOUND", "File not found.", 404);
  const file = await getAccessibleFile(user.id, fileId, { activeOnly: true });
  if (!file) return errorJson("FILE_NOT_FOUND", "File not found.", 404);
  if (file.connectedAccount.provider !== "google_drive") {
    return errorJson(
      "UNSUPPORTED_PROVIDER",
      "Thumbnails are not supported for this provider.",
      400,
    );
  }
  return streamGoogleDriveThumbnailResponse(
    file.connectedAccount,
    file.providerFileId,
  );
}

export async function trashFileHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const fileId = params?.id;
  if (!fileId) return errorJson("FILE_NOT_FOUND", "File not found.", 404);
  const file = await prisma.file.findFirstOrThrow({
    where: { id: fileId, userId: user.id, status: "active" },
  });
  await prisma.file.update({
    where: { id: file.id },
    data: { status: "deleted", deletedAt: new Date() },
  });
  await createAuditLog(user.id, "TRASH_FILE", "file", file.id, {
    name: file.name,
  });
  return json({ status: "ok" });
}

export async function batchDownloadHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const body = batchFileSchema.parse(await request.json());
  const files = await prisma.file.findMany({
    where: { id: { in: body.fileIds }, userId: user.id, status: "active" },
    include: { connectedAccount: true },
  });
  if (files.length === 0)
    return errorJson("FILES_NOT_FOUND", "No files found.", 404);

  const passThrough = new PassThrough();
  const archive = new ZipArchive({ zlib: { level: 9 } });
  archive.on("error", (err: Error) => {
    passThrough.destroy(err);
  });
  archive.pipe(passThrough);

  void (async () => {
    for (const file of files) {
      try {
        const media = await fetchGoogleDriveFileMedia(file.connectedAccount, {
          providerFileId: file.providerFileId,
          mimeType: file.mimeType,
          name: file.name,
        });
        if (!media) continue;
        const stream = Readable.fromWeb(
          media.response.body as Parameters<typeof Readable.fromWeb>[0],
        );
        archive.append(stream, { name: media.fileName });
      } catch (err) {
        console.error(`Failed to add file ${file.name} to zip:`, err);
      }
    }
    await archive.finalize();
  })();

  return new Response(Readable.toWeb(passThrough) as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="archivecloud-download.zip"',
    },
  });
}
