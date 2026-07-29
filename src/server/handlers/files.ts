import { PassThrough, Readable } from "node:stream";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { ZipArchive } from "archiver";
import { google } from "googleapis";
import { z } from "zod";
import { env } from "@/server/config/env";
import { prisma } from "@/server/config/prisma";
import { requireAuthUser } from "@/server/http/auth";
import { errorJson, json } from "@/server/http/responses";
import { streamProviderFileResponse } from "@/server/modules/files/stream-file";
import {
  googleDownloadExportMimeTypes,
  normalizeHeaders,
  withExtension,
} from "@/server/modules/files/stream-google-file";
import {
  getAuthedGoogleClient,
  syncGoogleAppFolderFiles,
  syncGoogleQuota,
} from "@/server/modules/google/google.service";
import {
  createS3Client,
  deleteS3Object,
  getS3ConfigForAccount,
  syncS3Quota,
} from "@/server/modules/s3/s3.service";
import { createAuditLog } from "@/server/utils/audit";
import { hashToken, randomToken } from "@/server/utils/crypto";
import { serializeFile, touchFileAccess } from "@/server/lib/file-serialize";

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
      limit: z.coerce.number().int().min(1).max(100).optional(),
    })
    .parse(Object.fromEntries(url.searchParams));

  const where: Record<string, unknown> = {
    userId: user.id,
    status: "active",
    ...(query.folderId ? { folderId: query.folderId } : {}),
    ...(query.q ? { name: { contains: query.q } } : {}),
    ...(query.accountId ? { connectedAccountId: query.accountId } : {}),
    ...(query.kind ? { mimeType: { in: typeFilters[query.kind] || [] } } : {}),
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
  } else if (!query.folderId) {
    where.isArchived = false;
  }

  const orderBy =
    query.view === "starred"
      ? [{ starredAt: "desc" as const }, { updatedAt: "desc" as const }]
      : query.view === "archived"
        ? [{ archivedAt: "desc" as const }, { updatedAt: "desc" as const }]
        : query.view === "recent"
          ? [
              { lastAccessedAt: "desc" as const },
              { updatedAt: "desc" as const },
            ]
          : [{ createdAt: "desc" as const }];

  const files = await prisma.file.findMany({
    where,
    include: {
      connectedAccount: { select: { id: true, email: true, provider: true } },
      folder: { select: { id: true, name: true } },
    },
    orderBy,
    ...(query.limit ? { take: query.limit } : {}),
  });
  return json({
    files: files.map((file) => serializeFile(file)),
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
    .object({ q: z.string().trim().max(255).optional() })
    .parse(Object.fromEntries(url.searchParams));
  const files = await prisma.file.findMany({
    where: {
      userId: user.id,
      status: "deleted",
      ...(query.q ? { name: { contains: query.q } } : {}),
    },
    include: {
      connectedAccount: { select: { id: true, email: true, provider: true } },
      folder: { select: { id: true, name: true } },
    },
    orderBy: { deletedAt: "desc" },
  });
  return json({
    files: files.map((file) => ({
      ...file,
      sizeBytes: file.sizeBytes.toString(),
    })),
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
      if (file.provider === "s3") {
        await deleteS3Object(file);
      } else {
        const auth = await getAuthedGoogleClient(file.connectedAccount);
        const drive = google.drive({ version: "v3", auth });
        await drive.files.delete({ fileId: file.providerFileId });
      }
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
    const account = files.find(
      (file) => file.connectedAccountId === accountId,
    )?.connectedAccount;
    if (account?.provider === "s3") {
      await syncS3Quota(accountId).catch(() => undefined);
    } else {
      await syncGoogleQuota(accountId).catch(() => undefined);
    }
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
          connectedAccount: { select: { email: true, provider: true } },
          folder: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return json({
    shares: shares
      .filter((share) => share.file.status === "active")
      .map((share) => {
        const url = share.token
          ? `${env.APP_URL}/public/files/${share.token}`
          : null;
        return {
          id: share.id,
          url,
          createdAt: share.createdAt.toISOString(),
          expiresAt: share.expiresAt?.toISOString() ?? null,
          file: { ...share.file, sizeBytes: share.file.sizeBytes.toString() },
        };
      }),
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
  const file = await prisma.file.findFirstOrThrow({
    where: { id: fileId, userId: user.id },
    include: {
      connectedAccount: { select: { id: true, email: true, provider: true } },
      folder: { select: { id: true, name: true } },
    },
  });
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
  const drive =
    file.provider === "s3"
      ? null
      : google.drive({
          version: "v3",
          auth: await getAuthedGoogleClient(file.connectedAccount),
        });
  if (body.folderId)
    await prisma.folder.findFirstOrThrow({
      where: { id: body.folderId, userId: user.id, deletedAt: null },
    });
  if (body.name && drive)
    await drive.files.update({
      fileId: file.providerFileId,
      requestBody: { name: body.name },
    });
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
      connectedAccount: { select: { id: true, email: true, provider: true } },
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

export async function shareFileHandler(
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
  const existingShare = await prisma.fileShare.findFirst({
    where: {
      fileId: file.id,
      userId: user.id,
      enabled: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
  });
  let shareId = existingShare?.id;
  let token = existingShare?.token;
  if (!existingShare) {
    token = randomToken(32);
    const share = await prisma.fileShare.create({
      data: {
        fileId: file.id,
        userId: user.id,
        token,
        tokenHash: hashToken(token),
      },
    });
    shareId = share.id;
  }
  return json(
    { url: `${env.APP_URL}/public/files/${token}`, shareId },
    existingShare ? 200 : 201,
  );
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
    const auth = await getAuthedGoogleClient(file.connectedAccount);
    const drive = google.drive({ version: "v3", auth });
    await drive.permissions.create({
      fileId: file.providerFileId,
      requestBody: { role: "writer", type: "anyone" },
    });
    const metadata = await drive.files.get({
      fileId: file.providerFileId,
      fields: "webViewLink,webContentLink",
    });
    return json({
      status: "ok",
      url: metadata.data.webViewLink ?? metadata.data.webContentLink,
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
  await prisma.fileShare.updateMany({
    where: { fileId, userId: user.id, enabled: true },
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
  const file = await prisma.file.findFirstOrThrow({
    where: { id: fileId, userId: user.id, status: "active" },
  });
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
  const file = await prisma.file.findFirstOrThrow({
    where: { id: fileId, userId: user.id },
    include: { connectedAccount: true },
  });
  if (file.provider === "s3") return json({ url: null });
  const auth = await getAuthedGoogleClient(file.connectedAccount);
  const drive = google.drive({ version: "v3", auth });
  try {
    await drive.permissions.create({
      fileId: file.providerFileId,
      requestBody: { role: "writer", type: "anyone" },
    });
  } catch (err) {
    console.error(
      "Failed to make Google Drive file public during view-url retrieval:",
      err instanceof Error ? err.message : err,
    );
  }
  const metadata = await drive.files.get({
    fileId: file.providerFileId,
    fields: "webViewLink,webContentLink",
  });
  return json({
    url: metadata.data.webViewLink ?? metadata.data.webContentLink,
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
  const file = await prisma.file.findFirstOrThrow({
    where: { id: fileId, userId: user.id },
    include: { connectedAccount: true },
  });
  await touchFileAccess(user.id, file.id, "DOWNLOAD_FILE");
  return streamProviderFileResponse(
    file,
    request.headers.get("range") ?? undefined,
    { disposition: "attachment" },
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
        let stream: Readable;
        let fileName = file.name;
        if (file.provider === "s3") {
          const config = await getS3ConfigForAccount(file.connectedAccountId);
          const client = createS3Client(config);
          const response = await client.send(
            new GetObjectCommand({
              Bucket: config.bucket,
              Key: file.providerFileId,
            }),
          );
          stream = response.Body as Readable;
        } else {
          const auth = await getAuthedGoogleClient(file.connectedAccount);
          const headers = normalizeHeaders(await auth.getRequestHeaders());
          const exportTarget = googleDownloadExportMimeTypes[file.mimeType];
          if (exportTarget) {
            fileName = withExtension(file.name, exportTarget.extension);
          }
          const url = exportTarget
            ? `https://www.googleapis.com/drive/v3/files/${file.providerFileId}/export?mimeType=${encodeURIComponent(exportTarget.mimeType)}`
            : `https://www.googleapis.com/drive/v3/files/${file.providerFileId}?alt=media`;
          const response = await fetch(url, { headers });
          if (!response.ok || !response.body) continue;
          stream = Readable.fromWeb(
            response.body as Parameters<typeof Readable.fromWeb>[0],
          );
        }
        archive.append(stream, { name: fileName });
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
