import { z } from "zod";
import { prisma } from "@/server/config/prisma";
import { requireAuthUser } from "@/server/http/auth";
import { errorJson, json } from "@/server/http/responses";
import { getProviderFileMeta } from "@/server/modules/providers/operations";
import { isSupportedProvider } from "@/server/modules/providers/types";
import { enqueueTransferJob } from "@/server/modules/transfers/process-job";
import {
  assertTransferCapacity,
  getTransferUsage,
} from "@/server/modules/transfers/usage";
import { createAuditLog } from "@/server/utils/audit";

function serializeJob(job: {
  id: string;
  type: string;
  status: string;
  sourceAccountId: string;
  destAccountId: string;
  sourceProviderFileId: string;
  destProviderFileId: string | null;
  destParentId: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: bigint;
  transferredBytes: bigint;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  sourceAccount?: { email: string; displayName: string | null } | null;
  destAccount?: { email: string; displayName: string | null } | null;
}) {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    sourceAccountId: job.sourceAccountId,
    destAccountId: job.destAccountId,
    sourceProviderFileId: job.sourceProviderFileId,
    destProviderFileId: job.destProviderFileId,
    destParentId: job.destParentId,
    fileName: job.fileName,
    mimeType: job.mimeType,
    sizeBytes: job.sizeBytes.toString(),
    transferredBytes: job.transferredBytes.toString(),
    errorMessage: job.errorMessage,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    sourceAccountEmail: job.sourceAccount?.email ?? null,
    sourceAccountName: job.sourceAccount?.displayName ?? null,
    destAccountEmail: job.destAccount?.email ?? null,
    destAccountName: job.destAccount?.displayName ?? null,
  };
}

async function resolveProviderFileMeta(
  accountId: string,
  userId: string,
  providerFileId: string,
) {
  const account = await prisma.connectedAccount.findFirst({
    where: {
      id: accountId,
      userId,
      status: "connected",
    },
  });
  if (!account) return null;
  if (!isSupportedProvider(account.provider)) return null;

  try {
    const meta = await getProviderFileMeta(account, providerFileId);
    return { account, ...meta };
  } catch {
    return null;
  }
}

export async function listTransferJobsHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const url = new URL(request.url);
  const query = z
    .object({
      status: z
        .enum(["queued", "running", "completed", "failed", "cancelled"])
        .optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    })
    .parse(Object.fromEntries(url.searchParams));

  const jobs = await prisma.transferJob.findMany({
    where: {
      userId: user.id,
      ...(query.status ? { status: query.status } : {}),
    },
    include: {
      sourceAccount: { select: { email: true, displayName: true } },
      destAccount: { select: { email: true, displayName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: query.limit ?? 50,
  });

  return json({ jobs: jobs.map(serializeJob) });
}

export async function getTransferUsageHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const usage = await getTransferUsage(user.id);
  return json({
    yearMonth: usage.yearMonth,
    transferredBytes: usage.transferredBytes.toString(),
    limitBytes: usage.limitBytes === null ? null : usage.limitBytes.toString(),
    remainingBytes:
      usage.remainingBytes === null ? null : usage.remainingBytes.toString(),
  });
}

export async function createTransferCopyHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  const body = z
    .object({
      sourceAccountId: z.string().min(1),
      destAccountId: z.string().min(1),
      sourceProviderFileId: z.string().min(1),
      destParentId: z.string().min(1).optional().nullable(),
      fileName: z.string().trim().min(1).max(255).optional(),

      sourceFileId: z.string().min(1).optional(),
    })
    .parse(await request.json());

  if (body.sourceAccountId === body.destAccountId && !body.destParentId) {
    return errorJson(
      "VALIDATION_ERROR",
      "Choose a destination folder when copying within the same account.",
      400,
    );
  }

  const [sourceAccount, destAccount] = await Promise.all([
    prisma.connectedAccount.findFirst({
      where: {
        id: body.sourceAccountId,
        userId: user.id,
        status: "connected",
      },
    }),
    prisma.connectedAccount.findFirst({
      where: { id: body.destAccountId, userId: user.id, status: "connected" },
    }),
  ]);
  if (!sourceAccount || !destAccount) {
    return errorJson(
      "ACCOUNT_NOT_FOUND",
      "Source or destination account not found.",
      404,
    );
  }
  if (
    !isSupportedProvider(sourceAccount.provider) ||
    !isSupportedProvider(destAccount.provider)
  ) {
    return errorJson(
      "UNSUPPORTED_PROVIDER",
      "Cloud-to-cloud copy currently supports all connected providers in the catalog.",
      400,
    );
  }

  let fileName = body.fileName ?? "untitled";
  let mimeType = "application/octet-stream";
  let sizeBytes = 0n;
  let sourceProviderFileId = body.sourceProviderFileId;

  if (body.sourceFileId) {
    const file = await prisma.file.findFirst({
      where: {
        id: body.sourceFileId,
        userId: user.id,
        status: "active",
        deletedAt: null,
      },
    });
    if (!file) {
      return errorJson("FILE_NOT_FOUND", "Source file not found.", 404);
    }
    sourceProviderFileId = file.providerFileId;
    fileName = body.fileName ?? file.name;
    mimeType = file.mimeType;
    sizeBytes = file.sizeBytes;
    if (file.connectedAccountId !== body.sourceAccountId) {
      return errorJson(
        "VALIDATION_ERROR",
        "Source file does not belong to the selected account.",
        400,
      );
    }
  } else {
    const meta = await resolveProviderFileMeta(
      body.sourceAccountId,
      user.id,
      body.sourceProviderFileId,
    );
    if (!meta) {
      return errorJson(
        "FILE_NOT_FOUND",
        "Could not read source file from the cloud provider.",
        404,
      );
    }
    fileName = body.fileName ?? meta.name;
    mimeType = meta.mimeType;
    sizeBytes = meta.sizeBytes;
  }

  try {
    await assertTransferCapacity(user.id, sizeBytes > 0n ? sizeBytes : 1n);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Transfer limit exceeded.";
    return errorJson("TRANSFER_LIMIT_EXCEEDED", message, 402);
  }

  const job = await prisma.transferJob.create({
    data: {
      userId: user.id,
      type: "copy",
      status: "queued",
      sourceAccountId: body.sourceAccountId,
      destAccountId: body.destAccountId,
      sourceProviderFileId,
      destParentId: body.destParentId ?? null,
      fileName,
      mimeType,
      sizeBytes,
    },
    include: {
      sourceAccount: { select: { email: true, displayName: true } },
      destAccount: { select: { email: true, displayName: true } },
    },
  });

  await createAuditLog(
    user.id,
    "TRANSFER_COPY_QUEUED",
    "transfer_job",
    job.id,
    {
      sourceAccountId: body.sourceAccountId,
      destAccountId: body.destAccountId,
      fileName,
    },
  );

  enqueueTransferJob(job.id);
  return json({ job: serializeJob(job) }, 201);
}

export async function getTransferJobHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const id = params?.id;
  if (!id) return errorJson("NOT_FOUND", "Job not found.", 404);
  const job = await prisma.transferJob.findFirst({
    where: { id, userId: user.id },
    include: {
      sourceAccount: { select: { email: true, displayName: true } },
      destAccount: { select: { email: true, displayName: true } },
    },
  });
  if (!job) return errorJson("NOT_FOUND", "Job not found.", 404);
  return json({ job: serializeJob(job) });
}

export async function retryTransferJobHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const id = params?.id;
  if (!id) return errorJson("NOT_FOUND", "Job not found.", 404);
  const job = await prisma.transferJob.findFirst({
    where: { id, userId: user.id },
  });
  if (!job) return errorJson("NOT_FOUND", "Job not found.", 404);
  if (job.status !== "failed") {
    return errorJson("INVALID_STATUS", "Only failed jobs can be retried.", 400);
  }

  const updated = await prisma.transferJob.update({
    where: { id: job.id },
    data: {
      status: "queued",
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      transferredBytes: 0n,
      destProviderFileId: null,
    },
    include: {
      sourceAccount: { select: { email: true, displayName: true } },
      destAccount: { select: { email: true, displayName: true } },
    },
  });
  enqueueTransferJob(updated.id);
  return json({ job: serializeJob(updated) });
}
