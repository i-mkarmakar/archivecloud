import "server-only";

import { prisma } from "@/server/config/prisma";
import { enqueueTransferJob } from "@/server/modules/transfers/process-job";
import { createAuditLog } from "@/server/utils/audit";

function computeNextRunAt(scheduleKind: string, from: Date) {
  const d = new Date(from);
  if (scheduleKind === "daily") {
    d.setDate(d.getDate() + 1);
    return d;
  }
  if (scheduleKind === "weekly") {
    d.setDate(d.getDate() + 7);
    return d;
  }
  if (scheduleKind === "monthly") {
    d.setMonth(d.getMonth() + 1);
    return d;
  }
  return d;
}

export async function runScheduledTransferTick(options?: {
  userId?: string;
  limit?: number;
}) {
  const now = new Date();
  const limit = options?.limit ?? 50;

  const dueTasks = await prisma.scheduledTransfer.findMany({
    where: {
      ...(options?.userId ? { userId: options.userId } : {}),
      status: "active",
      nextRunAt: { lte: now },
    },
    orderBy: { nextRunAt: "asc" },
    take: limit,
  });

  let queuedJobs = 0;
  let processedTasks = 0;
  let failedTasks = 0;

  for (const task of dueTasks) {
    processedTasks += 1;
    try {
      const job = await prisma.transferJob.create({
        data: {
          userId: task.userId,
          type: task.operation,
          status: "queued",
          sourceAccountId: task.sourceAccountId,
          destAccountId: task.destAccountId,
          sourceProviderFileId: task.sourceProviderFileId,
          destParentId: task.destParentId,
          fileName: task.fileName,
          mimeType: task.mimeType,
          sizeBytes: task.sizeBytes,
        },
      });

      enqueueTransferJob(job.id);
      queuedJobs += 1;

      const isOnce = task.scheduleKind === "once";
      const newNextRunAt = isOnce
        ? now
        : computeNextRunAt(task.scheduleKind, now);

      await prisma.scheduledTransfer.update({
        where: { id: task.id },
        data: {
          lastRunAt: now,
          nextRunAt: newNextRunAt,
          completedAt: isOnce ? now : null,
          status: isOnce ? "completed" : "active",
          errorMessage: null,
        },
      });

      await createAuditLog(
        task.userId,
        "SCHEDULED_TRANSFER_ENQUEUED",
        "scheduled_transfer",
        task.id,
        {
          jobId: job.id,
          sizeBytes: task.sizeBytes.toString(),
          nextRunAt: newNextRunAt.toISOString(),
          via: options?.userId ? "session" : "cron",
        },
      );
    } catch (error) {
      failedTasks += 1;
      const message =
        error instanceof Error ? error.message : "Scheduled transfer failed.";
      await prisma.scheduledTransfer.update({
        where: { id: task.id },
        data: {
          status: "failed",
          errorMessage: message,
          lastRunAt: now,
          completedAt: now,
          nextRunAt: now,
        },
      });
    }
  }

  return { processedTasks, queuedJobs, failedTasks };
}
