import { z } from "zod";
import { prisma } from "@/server/config/prisma";
import { requireAuthUserOrApiKey } from "@/server/http/api-key-auth";
import { errorJson, json } from "@/server/http/responses";
import { serializeStorageAccount } from "@/server/lib/storage-serialize";
import { getProviderFileMeta } from "@/server/modules/providers/operations";
import { isSupportedProvider } from "@/server/modules/providers/types";
import { enqueueTransferJob } from "@/server/modules/transfers/process-job";
import { assertTransferCapacity } from "@/server/modules/transfers/usage";
import { createAuditLog } from "@/server/utils/audit";

export async function apiV1ListAccountsHandler(request: Request) {
  const user = await requireAuthUserOrApiKey(request, ["accounts:read"]);
  if (user instanceof Response) return user;

  const accounts = await prisma.connectedAccount.findMany({
    where: { userId: user.id, status: "connected" },
    include: { storageAccount: true },
    orderBy: { createdAt: "desc" },
  });

  return json({
    accounts: accounts.map(
      ({
        accessTokenEncrypted: _a,
        refreshTokenEncrypted: _r,
        storageAccount,
        ...account
      }) => ({
        id: account.id,
        provider: account.provider,
        email: account.email,
        displayName: account.displayName,
        status: account.status,
        createdAt: account.createdAt.toISOString(),
        storageAccount: storageAccount
          ? serializeStorageAccount(storageAccount)
          : null,
      }),
    ),
  });
}

export async function apiV1ListTransfersHandler(request: Request) {
  const user = await requireAuthUserOrApiKey(request, ["transfers:read"]);
  if (user instanceof Response) return user;

  const url = new URL(request.url);
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit") ?? "20") || 20),
  );

  const jobs = await prisma.transferJob.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      sourceAccount: { select: { email: true, displayName: true } },
      destAccount: { select: { email: true, displayName: true } },
    },
  });

  return json({
    jobs: jobs.map((job) => ({
      id: job.id,
      type: job.type,
      status: job.status,
      fileName: job.fileName,
      sizeBytes: job.sizeBytes.toString(),
      transferredBytes: job.transferredBytes.toString(),
      errorMessage: job.errorMessage,
      sourceAccountId: job.sourceAccountId,
      destAccountId: job.destAccountId,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
    })),
  });
}

export async function apiV1CreateTransferHandler(request: Request) {
  const user = await requireAuthUserOrApiKey(request, ["transfers:write"]);
  if (user instanceof Response) return user;

  const body = z
    .object({
      sourceAccountId: z.string().min(1),
      destAccountId: z.string().min(1),
      sourceProviderFileId: z.string().min(1),
      destParentId: z.string().min(1).optional().nullable(),
      fileName: z.string().max(512).optional(),
    })
    .parse(await request.json());

  const [sourceAccount, destAccount] = await Promise.all([
    prisma.connectedAccount.findFirst({
      where: {
        id: body.sourceAccountId,
        userId: user.id,
        status: "connected",
      },
    }),
    prisma.connectedAccount.findFirst({
      where: {
        id: body.destAccountId,
        userId: user.id,
        status: "connected",
      },
    }),
  ]);

  if (!sourceAccount || !destAccount) {
    return errorJson("ACCOUNT_NOT_FOUND", "Source or destination account not found.", 404);
  }
  if (
    !isSupportedProvider(sourceAccount.provider) ||
    !isSupportedProvider(destAccount.provider)
  ) {
    return errorJson(
      "UNSUPPORTED_PROVIDER",
      "One or both accounts use an unsupported provider.",
      400,
    );
  }

  let fileName = body.fileName ?? "untitled";
  let mimeType = "application/octet-stream";
  let sizeBytes = 0n;

  try {
    const meta = await getProviderFileMeta(
      sourceAccount,
      body.sourceProviderFileId,
    );
    fileName = body.fileName ?? meta.name;
    mimeType = meta.mimeType;
    sizeBytes = meta.sizeBytes;
  } catch {
    return errorJson(
      "FILE_NOT_FOUND",
      "Could not read source file from the cloud provider.",
      404,
    );
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
      sourceProviderFileId: body.sourceProviderFileId,
      destParentId: body.destParentId ?? null,
      fileName,
      mimeType,
      sizeBytes,
    },
  });

  await createAuditLog(user.id, "API_TRANSFER_QUEUED", "transfer_job", job.id, {
    via: user.via,
    apiKeyId: user.apiKeyId,
    fileName,
  });

  enqueueTransferJob(job.id);
  return json(
    {
      job: {
        id: job.id,
        status: job.status,
        fileName: job.fileName,
        sizeBytes: job.sizeBytes.toString(),
      },
    },
    201,
  );
}
