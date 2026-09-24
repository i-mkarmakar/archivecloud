import { Readable, Transform } from "node:stream";
import Busboy from "busboy";
import { z } from "zod";
import { env } from "@/server/config/env";
import { prisma } from "@/server/config/prisma";
import { type AuthUser, requireAuthUser } from "@/server/http/auth";
import { errorJson, json } from "@/server/http/responses";
import {
  ensureGoogleAppFolder,
  syncGoogleQuota,
} from "@/server/modules/google/google.service";
import {
  initGoogleDriveResumableUpload,
  putGoogleDriveResumableChunk,
  queryGoogleDriveResumableStatus,
  uploadGoogleDriveMediaFile,
} from "@/server/modules/providers/google-drive-upload";
import { createAuditLog } from "@/server/utils/audit";

type UploadMeta = {
  fieldName: string;
  fileName: string;
  mimeType: string;
  sizeBytes: bigint;
  folderId?: string;
};
type RoutingMode = "most_available" | "round_robin" | "priority";

function logUpload(message: string, metadata?: Record<string, unknown>) {
  console.info("[upload]", message, metadata ?? "");
}

function syncQuotaInBackground(accountId: string, sessionId: string) {
  logUpload("quota sync started", { accountId, sessionId });
  syncGoogleQuota(accountId)
    .then(() => logUpload("quota sync completed", { accountId, sessionId }))
    .catch((error) =>
      logUpload("quota sync failed", {
        accountId,
        sessionId,
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    );
}

function normalizePriorityAccountIds(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function byPriority<T extends { account: { id: string; createdAt: Date } }>(
  items: T[],
  priorityAccountIds: string[],
) {
  const order = new Map(priorityAccountIds.map((id, index) => [id, index]));
  return [...items].sort((a, b) => {
    const aOrder = order.get(a.account.id);
    const bOrder = order.get(b.account.id);
    if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder;
    if (aOrder !== undefined) return -1;
    if (bOrder !== undefined) return 1;
    return a.account.createdAt.getTime() - b.account.createdAt.getTime();
  });
}

async function selectAccount(
  userId: string,
  sizeBytes: bigint,
  reservedBytesByAccount = new Map<string, bigint>(),
  targetAccountId?: string | null,
) {
  const accounts = await prisma.connectedAccount.findMany({
    where: {
      userId,
      provider: "google_drive",
      status: "connected",
      ...(targetAccountId ? { id: targetAccountId } : {}),
    },
    include: { storageAccount: true },
  });

  const stale = accounts.filter(
    (account) =>
      !account.storageAccount?.lastSyncedAt ||
      account.storageAccount.lastSyncedAt.getTime() < Date.now() - 5 * 60_000,
  );
  await Promise.allSettled(
    stale.map(async (account) => {
      try {
        await syncGoogleQuota(account.id);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Quota sync failed";
        console.error(
          `[upload] failed to sync quota for account ${account.email} (${account.id}):`,
          message,
        );
        await prisma.connectedAccount
          .update({
            where: { id: account.id },
            data: { lastError: message },
          })
          .catch(() => undefined);
      }
    }),
  );

  const fresh = await prisma.connectedAccount.findMany({
    where: {
      userId,
      provider: "google_drive",
      status: "connected",
    },
    include: { storageAccount: true },
  });

  const eligible = fresh
    .map((account) => ({
      account,
      availableBytes:
        account.storageAccount?.availableBytes === null ||
        account.storageAccount?.availableBytes === undefined
          ? null
          : account.storageAccount.availableBytes -
            (reservedBytesByAccount.get(account.id) ?? 0n),
    }))
    .filter(
      ({ availableBytes }) =>
        availableBytes === null || availableBytes >= sizeBytes,
    );

  if (eligible.length === 0) return null;

  if (targetAccountId) {
    const target = eligible.find((e) => e.account.id === targetAccountId);
    return target?.account ?? null;
  }

  const policy = await prisma.uploadRoutingPolicy.upsert({
    where: { userId },
    create: { userId, mode: "most_available", priorityAccountIds: [] },
    update: {},
  });
  const mode = (
    ["most_available", "round_robin", "priority"].includes(policy.mode)
      ? policy.mode
      : "most_available"
  ) as RoutingMode;
  const priorityAccountIds = normalizePriorityAccountIds(
    policy.priorityAccountIds,
  );

  if (mode === "priority")
    return byPriority(eligible, priorityAccountIds)[0]?.account ?? null;

  if (mode === "round_robin") {
    const ordered = byPriority(eligible, priorityAccountIds);
    const selected =
      ordered[policy.roundRobinCursor % ordered.length]?.account ??
      ordered[0]?.account ??
      null;
    await prisma.uploadRoutingPolicy.update({
      where: { userId },
      data: { roundRobinCursor: policy.roundRobinCursor + 1 },
    });
    return selected;
  }

  return eligible.sort((a, b) => {
    if (a.availableBytes === null && b.availableBytes === null) return 0;
    if (a.availableBytes === null) return 1;
    if (b.availableBytes === null) return -1;
    return Number(b.availableBytes - a.availableBytes);
  })[0]?.account;
}

function requestHeadersRecord(request: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
}

export async function handleUploadRequest(
  request: Request,
  authUser?: AuthUser,
): Promise<Response> {
  const user = authUser ?? (await requireAuthUser(request));
  if (user instanceof Response) return user;

  logUpload("request started", {
    userId: user.id,
    contentLength: request.headers.get("content-length"),
  });
  const contentType = request.headers.get("content-type");
  if (!contentType?.includes("multipart/form-data")) {
    return errorJson(
      "UPLOAD_INVALID_CONTENT_TYPE",
      "multipart/form-data required.",
      400,
    );
  }
  if (!request.body) {
    return errorJson("UPLOAD_FILE_REQUIRED", "Request body required.", 400);
  }

  return new Promise((resolve) => {
    const busboy = Busboy({
      headers: requestHeadersRecord(request),
      limits: { files: 25, fileSize: env.MAX_UPLOAD_BYTES },
    });
    const fields: {
      sizeBytes?: bigint;
      fileName?: string;
      mimeType?: string;
      folderId?: string;
    } = {};
    let batchMeta: UploadMeta[] | null = null;
    let responded = false;
    let fileSeen = false;
    const reservedBytesByAccount = new Map<string, bigint>();
    const completed: Array<Record<string, unknown>> = [];
    const failed: Array<{ fileName: string; code: string; message: string }> =
      [];
    const pendingUploads: Array<Promise<void>> = [];

    const fail = (status: number, code: string, message: string) => {
      if (responded) return;
      responded = true;
      resolve(errorJson(code, message, status));
    };

    const parseBatchMeta = (value: string) =>
      JSON.parse(value).map(
        (item: {
          fieldName: string;
          fileName: string;
          mimeType: string;
          sizeBytes: string | number;
          folderId?: string;
        }) => ({
          fieldName: item.fieldName,
          fileName: item.fileName,
          mimeType: item.mimeType,
          sizeBytes: BigInt(item.sizeBytes),
          folderId: item.folderId,
        }),
      ) as UploadMeta[];

    const metaForFile = (
      fieldName: string,
      info: { filename: string; mimeType: string },
    ) => {
      if (batchMeta)
        return batchMeta.find((item) => item.fieldName === fieldName);
      const sizeBytes = fields.sizeBytes;
      if (!sizeBytes) return null;
      return {
        fieldName,
        sizeBytes,
        fileName: fields.fileName || info.filename,
        mimeType:
          fields.mimeType || info.mimeType || "application/octet-stream",
        folderId: fields.folderId,
      };
    };

    const uploadOne = async (
      fieldName: string,
      fileStream: NodeJS.ReadableStream,
      info: { filename: string; mimeType: string },
    ) => {
      const meta = metaForFile(fieldName, info);
      const fileName = meta?.fileName || info.filename;
      try {
        fileStream.on("limit", () =>
          logUpload("file stream size limit reached", { fileName }),
        );
        if (!meta?.sizeBytes || meta.sizeBytes <= 0n) {
          fileStream.resume();
          failed.push({
            fileName,
            code: "UPLOAD_SIZE_REQUIRED",
            message: "sizeBytes field must be sent before file field.",
          });
          return;
        }
        if (meta.sizeBytes > BigInt(env.MAX_UPLOAD_BYTES)) {
          fileStream.resume();
          failed.push({
            fileName,
            code: "UPLOAD_TOO_LARGE",
            message: "File exceeds max upload size.",
          });
          return;
        }

        const folderId = meta.folderId || null;
        let targetAccountId: string | undefined;
        if (folderId) {
          const folderRecord = await prisma.folder.findFirstOrThrow({
            where: { id: folderId, userId: user.id, deletedAt: null },
          });
          if (folderRecord.connectedAccountId) {
            targetAccountId = folderRecord.connectedAccountId;
          }
        }

        const account = await selectAccount(
          user.id,
          meta.sizeBytes,
          reservedBytesByAccount,
          targetAccountId,
        );
        if (!account) {
          fileStream.resume();
          failed.push({
            fileName,
            code: "NO_ACCOUNT_WITH_ENOUGH_SPACE",
            message:
              "No connected storage account has enough space for this upload.",
          });
          return;
        }
        reservedBytesByAccount.set(
          account.id,
          (reservedBytesByAccount.get(account.id) ?? 0n) + meta.sizeBytes,
        );

        const session = await prisma.uploadSession.create({
          data: {
            userId: user.id,
            targetConnectedAccountId: account.id,
            folderId,
            fileName,
            mimeType: meta.mimeType,
            sizeBytes: meta.sizeBytes,
            status: "uploading",
          },
        });
        logUpload("file upload started", {
          sessionId: session.id,
          accountId: account.id,
          fileName,
          sizeBytes: meta.sizeBytes.toString(),
        });

        let streamedBytes = 0n;
        const countingStream = new Transform({
          transform(chunk, _encoding, callback) {
            streamedBytes += BigInt((chunk as Buffer).length);
            if (streamedBytes > meta.sizeBytes) {
              callback(
                new Error("Streamed byte count exceeded declared size."),
              );
              return;
            }
            callback(null, chunk);
          },
        });
        fileStream.pipe(countingStream);

        let providerFileId = "";
        let uploadedName = fileName;
        let uploadedMimeType = meta.mimeType;
        const appFolderId = await ensureGoogleAppFolder(account);
        let targetParentId = appFolderId;
        if (folderId) {
          const folderRecord = await prisma.folder.findFirst({
            where: { id: folderId, userId: user.id },
          });
          if (folderRecord?.providerFolderId) {
            targetParentId = folderRecord.providerFolderId;
          }
        }
        const uploaded = await uploadGoogleDriveMediaFile({
          account,
          fileName,
          mimeType: meta.mimeType,
          parentId: targetParentId,
          body: countingStream,
        });
        providerFileId = uploaded.id;
        uploadedName = uploaded.name;
        uploadedMimeType = uploaded.mimeType;
        logUpload("google upload completed", {
          sessionId: session.id,
          accountId: account.id,
          fileName,
        });

        if (streamedBytes !== meta.sizeBytes) {
          await prisma.uploadSession.update({
            where: { id: session.id },
            data: {
              status: "failed",
              errorMessage: "Streamed byte count did not match declared size.",
            },
          });
          failed.push({
            fileName,
            code: "UPLOAD_SIZE_MISMATCH",
            message: "Streamed byte count did not match declared size.",
          });
          return;
        }

        const file = await prisma.file.create({
          data: {
            userId: user.id,
            connectedAccountId: account.id,
            folderId,
            provider: "google_drive",
            providerFileId,
            name: uploadedName,
            mimeType: uploadedMimeType,
            sizeBytes: meta.sizeBytes,
          },
        });
        logUpload("database file created", {
          sessionId: session.id,
          fileId: file.id,
          accountId: account.id,
        });
        completed.push({ ...file, sizeBytes: file.sizeBytes.toString() });
        await prisma.uploadSession.update({
          where: { id: session.id },
          data: { status: "completed", completedAt: new Date() },
        });
        syncQuotaInBackground(account.id, session.id);
      } catch (error) {
        fileStream.resume();
        logUpload("file upload failed", {
          fileName,
          message: error instanceof Error ? error.message : "Upload failed",
        });
        failed.push({
          fileName,
          code: "UPLOAD_FAILED",
          message: error instanceof Error ? error.message : "Upload failed",
        });
      }
    };

    busboy.on("field", (name, value) => {
      if (name === "sizeBytes") fields.sizeBytes = BigInt(value);
      if (name === "fileName") fields.fileName = value;
      if (name === "mimeType") fields.mimeType = value;
      if (name === "folderId") fields.folderId = value;
      if (name === "filesMeta") batchMeta = parseBatchMeta(value);
    });

    busboy.on("file", (name, fileStream, info) => {
      fileSeen = true;
      pendingUploads.push(uploadOne(name, fileStream, info));
    });

    busboy.on("error", (error) => {
      logUpload("multipart parser failed", {
        message: error instanceof Error ? error.message : "Unknown error",
      });
      if (!responded) {
        responded = true;
        resolve(
          errorJson(
            "UPLOAD_PARSE_FAILED",
            error instanceof Error ? error.message : "Upload parse failed",
            400,
          ),
        );
      }
    });

    busboy.on("finish", () => {
      if (!responded && !fileSeen)
        return fail(400, "UPLOAD_FILE_REQUIRED", "file field required.");
      Promise.all(pendingUploads)
        .then(() => {
          if (responded) return;
          responded = true;
          logUpload("response sent", {
            completed: completed.length,
            failed: failed.length,
          });
          if (completed.length === 0) {
            resolve(
              json(
                {
                  code: failed[0]?.code ?? "UPLOAD_FAILED",
                  message: failed[0]?.message ?? "Upload failed",
                  failed,
                },
                400,
              ),
            );
            return;
          }
          if (!batchMeta && completed.length === 1 && failed.length === 0) {
            resolve(json({ file: completed[0] }, 201));
            return;
          }
          resolve(json({ files: completed, failed }, 201));
        })
        .catch((error) => {
          if (!responded) {
            responded = true;
            resolve(
              errorJson(
                "UPLOAD_FAILED",
                error instanceof Error ? error.message : "Upload failed",
                500,
              ),
            );
          }
        });
    });

    Readable.fromWeb(
      request.body as Parameters<typeof Readable.fromWeb>[0],
    ).pipe(busboy);
  });
}

export async function resumableInitHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  const body = z
    .object({
      fileName: z.string().min(1),
      mimeType: z.string().min(1),
      sizeBytes: z.string(),
      folderId: z.string().nullable().optional(),
      targetAccountId: z.string().nullable().optional(),
    })
    .parse(await request.json());

  const sizeBytes = BigInt(body.sizeBytes);
  if (sizeBytes <= 0n)
    return errorJson("UPLOAD_SIZE_REQUIRED", "Valid sizeBytes required.", 400);
  if (sizeBytes > BigInt(env.MAX_UPLOAD_BYTES))
    return errorJson("UPLOAD_TOO_LARGE", "File exceeds max upload size.", 400);

  const folderId = body.folderId || null;
  let targetAccountId = body.targetAccountId;
  if (folderId) {
    const folderRecord = await prisma.folder.findFirstOrThrow({
      where: { id: folderId, userId: user.id, deletedAt: null },
    });
    if (folderRecord.connectedAccountId) {
      targetAccountId = folderRecord.connectedAccountId;
    }
  }

  const account = await selectAccount(
    user.id,
    sizeBytes,
    undefined,
    targetAccountId,
  );
  if (!account)
    return errorJson(
      "NO_ACCOUNT_WITH_ENOUGH_SPACE",
      "No connected storage account has enough space.",
      400,
    );

  if (account.provider !== "google_drive") {
    return errorJson(
      "UNSUPPORTED_PROVIDER",
      "Only Google Drive resumable uploads are supported.",
      400,
    );
  }

  const appFolderId = await ensureGoogleAppFolder(account);
  let targetParentId = appFolderId;
  if (folderId) {
    const folderRecord = await prisma.folder.findFirst({
      where: { id: folderId, userId: user.id },
    });
    if (folderRecord?.providerFolderId) {
      targetParentId = folderRecord.providerFolderId;
    }
  }

  const sessionUri = await initGoogleDriveResumableUpload({
    account,
    fileName: body.fileName,
    mimeType: body.mimeType,
    sizeBytes,
    parentId: targetParentId,
  });

  const session = await prisma.uploadSession.create({
    data: {
      userId: user.id,
      targetConnectedAccountId: account.id,
      folderId,
      fileName: body.fileName,
      mimeType: body.mimeType,
      sizeBytes,
      status: "uploading",
      googleSessionUri: sessionUri,
    },
  });

  return json(
    { sessionId: session.id, provider: "google_drive", offset: 0 },
    201,
  );
}

export async function resumableStatusHandler(
  request: Request,
  _user?: AuthUser,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  try {
    const session = await prisma.uploadSession.findFirstOrThrow({
      where: { id: String(params?.id), userId: user.id },
    });

    if (session.status === "completed") {
      return json({
        status: "completed",
        offset: session.sizeBytes.toString(),
      });
    }

    if (!session.googleSessionUri || !session.targetConnectedAccountId) {
      return json({ status: "uploading", offset: "0" });
    }

    const account = await prisma.connectedAccount.findFirstOrThrow({
      where: { id: session.targetConnectedAccountId, userId: user.id },
    });
    const queryRes = await queryGoogleDriveResumableStatus({
      account,
      sessionUri: session.googleSessionUri,
      sizeBytes: session.sizeBytes,
    });

    if (queryRes.status === 308) {
      const range = queryRes.headers.get("range");
      if (range) {
        const parts = range.split("-");
        const lastByte = BigInt(parts[1]);
        return json({
          status: "uploading",
          offset: (lastByte + 1n).toString(),
        });
      }
    } else if (queryRes.ok) {
      return json({
        status: "completed",
        offset: session.sizeBytes.toString(),
      });
    }

    return json({ status: "uploading", offset: "0" });
  } catch {
    return json({ status: "failed", offset: "0" });
  }
}

export async function resumableChunkHandler(
  request: Request,
  _user?: AuthUser,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  const session = await prisma.uploadSession.findFirstOrThrow({
    where: { id: String(params?.id), userId: user.id },
  });

  const rangeHeader = request.headers.get("content-range");
  if (!rangeHeader) {
    return errorJson(
      "MISSING_CONTENT_RANGE",
      "Content-Range header is required.",
      400,
    );
  }

  const match = rangeHeader.match(/bytes\s+(\d+)-(\d+)\/(\d+)/);
  if (!match)
    return errorJson(
      "INVALID_CONTENT_RANGE",
      "Invalid Content-Range format.",
      400,
    );

  const startByte = BigInt(match[1]);
  const endByte = BigInt(match[2]);
  const totalBytes = BigInt(match[3]);

  if (!session.googleSessionUri || !session.targetConnectedAccountId) {
    return errorJson(
      "UNSUPPORTED_PROVIDER",
      "Only Google Drive resumable uploads supported.",
      400,
    );
  }

  const account = await prisma.connectedAccount.findFirstOrThrow({
    where: { id: session.targetConnectedAccountId, userId: user.id },
  });
  const putRes = await putGoogleDriveResumableChunk({
    account,
    sessionUri: session.googleSessionUri,
    contentRange: rangeHeader,
    contentLength: (endByte - startByte + 1n).toString(),
    body: request.body,
  });

  if (putRes.status === 308) {
    return json({ status: "uploading", offset: (endByte + 1n).toString() });
  }

  if (putRes.ok) {
    const fileMeta = (await putRes.json()) as {
      id: string;
      name: string;
      mimeType: string;
    };

    let existingFile = await prisma.file.findFirst({
      where: { providerFileId: fileMeta.id, userId: user.id },
    });

    if (!existingFile) {
      existingFile = await prisma.file.create({
        data: {
          userId: user.id,
          connectedAccountId: account.id,
          folderId: session.folderId,
          provider: "google_drive",
          providerFileId: fileMeta.id,
          name: fileMeta.name || session.fileName,
          mimeType: fileMeta.mimeType || session.mimeType,
          sizeBytes: totalBytes,
        },
      });
    }

    await prisma.uploadSession.update({
      where: { id: session.id },
      data: { status: "completed", completedAt: new Date() },
    });

    await createAuditLog(user.id, "UPLOAD_FILE", "file", existingFile.id, {
      name: existingFile.name,
      size: existingFile.sizeBytes.toString(),
    });

    syncQuotaInBackground(account.id, session.id);

    return json(
      {
        status: "completed",
        file: { ...existingFile, sizeBytes: existingFile.sizeBytes.toString() },
      },
      201,
    );
  }

  const errorMsg = await putRes.text();
  await prisma.uploadSession.update({
    where: { id: session.id },
    data: { status: "failed", errorMessage: errorMsg },
  });

  return json({ code: "UPLOAD_FAILED", message: errorMsg }, putRes.status);
}
