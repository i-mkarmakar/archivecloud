import { z } from "zod";
import { prisma } from "@/server/config/prisma";
import { requireAuthUser } from "@/server/http/auth";
import { errorJson, json } from "@/server/http/responses";
import { requirePlanFeature } from "@/server/modules/billing/plan-gate";
import { isSupportedProvider } from "@/server/modules/providers/types";
import { createAuditLog } from "@/server/utils/audit";
import { runScheduledTransferTick } from "@/server/modules/automation/run-scheduled-tick";
import { type ScheduledTransfer } from "@/generated/prisma/client";

function serializeScheduledTask(task: ScheduledTransfer & {
  sourceAccount: { email: string | null; displayName: string | null };
  destAccount: { email: string | null; displayName: string | null };
}) {
  return {
    id: task.id,
    status: task.status,
    operation: task.operation,
    scheduleKind: task.scheduleKind,
    nextRunAt: task.nextRunAt.toISOString(),
    lastRunAt: task.lastRunAt?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
    errorMessage: task.errorMessage,
    createdAt: task.createdAt.toISOString(),
    sourceAccountId: task.sourceAccountId,
    destAccountId: task.destAccountId,
    destParentId: task.destParentId,
    sourceProviderFileId: task.sourceProviderFileId,
    fileName: task.fileName,
    mimeType: task.mimeType,
    sizeBytes: task.sizeBytes.toString(),
    sourceAccountEmail: task.sourceAccount.email,
    sourceAccountName: task.sourceAccount.displayName,
    destAccountEmail: task.destAccount.email,
    destAccountName: task.destAccount.displayName,
  };
}

export async function listScheduledTransfersHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  const tasks = await prisma.scheduledTransfer.findMany({
    where: { userId: user.id },
    include: {
      sourceAccount: { select: { email: true, displayName: true } },
      destAccount: { select: { email: true, displayName: true } },
    },
    orderBy: { nextRunAt: "desc" },
    take: 100,
  });

  return json({ tasks: tasks.map(serializeScheduledTask) });
}

export async function createScheduledTransferHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  const gated = await requirePlanFeature(
    user.id,
    "automation",
    "Scheduled automation is not available on this plan.",
  );
  if (gated) return gated;

  const body = z
    .object({
      sourceFileId: z.string().min(1),
      operation: z.enum(["copy", "move", "delete"]).default("copy"),
      destAccountId: z.string().min(1).optional(),
      destParentId: z.string().min(1).optional().nullable(),
      scheduleKind: z.enum(["once", "daily", "weekly", "monthly"]),
      startAt: z.string().datetime(),
    })
    .parse(await request.json());

  const startAt = new Date(body.startAt);
  if (Number.isNaN(startAt.getTime())) {
    return errorJson("VALIDATION_ERROR", "Invalid startAt datetime.", 400);
  }

  const file = await prisma.file.findFirst({
    where: {
      id: body.sourceFileId,
      userId: user.id,
      status: "active",
      deletedAt: null,
    },
    include: {
      connectedAccount: { select: { id: true, provider: true } },
    },
  });
  if (!file) {
    return errorJson("FILE_NOT_FOUND", "Source file not found.", 404);
  }

  const operation = body.operation;
  const destAccountId =
    operation === "delete" ? file.connectedAccountId : body.destAccountId;

  if (!destAccountId) {
    return errorJson(
      "VALIDATION_ERROR",
      "Destination account is required for copy/move operations.",
      400,
    );
  }

  const destAccount = await prisma.connectedAccount.findFirst({
    where: { id: destAccountId, userId: user.id, status: "connected" },
  });
  if (!destAccount)
    return errorJson(
      "ACCOUNT_NOT_FOUND",
      "Destination account not found.",
      404,
    );

  if (
    !isSupportedProvider(file.connectedAccount?.provider ?? "") ||
    !isSupportedProvider(destAccount.provider)
  ) {
    return errorJson(
      "UNSUPPORTED_PROVIDER",
      "Scheduled transfers require supported cloud providers.",
      400,
    );
  }

  const scheduled = await prisma.scheduledTransfer.create({
    data: {
      userId: user.id,
      status: "active",
      operation,
      scheduleKind: body.scheduleKind,
      nextRunAt: startAt,
      sourceAccountId: file.connectedAccountId,
      destAccountId,
      destParentId: body.destParentId ?? null,
      sourceProviderFileId: file.providerFileId,
      fileName: file.name,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
    },
  });

  await createAuditLog(
    user.id,
    "SCHEDULE_TRANSFER_CREATED",
    "scheduled_transfer",
    scheduled.id,
    {
      sourceAccountId: scheduled.sourceAccountId,
      destAccountId: scheduled.destAccountId,
      scheduleKind: scheduled.scheduleKind,
      nextRunAt: scheduled.nextRunAt.toISOString(),
    },
  );

  return json({ taskId: scheduled.id }, 201);
}

export async function cancelScheduledTransferHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const id = params?.id;
  if (!id) return errorJson("NOT_FOUND", "Task not found.", 404);

  const result = await prisma.scheduledTransfer.updateMany({
    where: { id, userId: user.id },
    data: { status: "cancelled", completedAt: new Date() },
  });
  if (result.count === 0) return errorJson("NOT_FOUND", "Task not found.", 404);
  return json({ status: "ok" });
}

export async function tickAutomationHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  const result = await runScheduledTransferTick({
    userId: user.id,
    limit: 20,
  });
  return json(result);
}

