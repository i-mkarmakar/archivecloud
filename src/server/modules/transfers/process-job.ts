import "server-only";

import { prisma } from "@/server/config/prisma";
import {
  copyBetweenProviders,
  deleteProviderFile,
} from "@/server/modules/transfers/copy-between-providers";
import {
  assertTransferCapacity,
  recordTransferUsage,
} from "@/server/modules/transfers/usage";
import { createAuditLog } from "@/server/utils/audit";

async function processTransferJob(jobId: string) {
  const job = await prisma.transferJob.findUnique({
    where: { id: jobId },
    include: {
      sourceAccount: true,
      destAccount: true,
    },
  });
  if (!job) return;
  if (job.status !== "queued" && job.status !== "running") return;

  await prisma.transferJob.update({
    where: { id: jobId },
    data: {
      status: "running",
      startedAt: job.startedAt ?? new Date(),
      errorMessage: null,
    },
  });

  try {
    if (
      job.sourceAccount.status !== "connected" ||
      job.destAccount.status !== "connected"
    ) {
      throw new Error("Source or destination account is disconnected.");
    }

    if (job.type === "delete") {
      await deleteProviderFile({
        account: job.sourceAccount,
        providerFileId: job.sourceProviderFileId,
      });

      await prisma.file.updateMany({
        where: {
          userId: job.userId,
          connectedAccountId: job.sourceAccountId,
          providerFileId: job.sourceProviderFileId,
          status: "active",
        },
        data: { status: "deleted", deletedAt: new Date() },
      });

      await prisma.transferJob.update({
        where: { id: jobId },
        data: {
          status: "completed",
          destProviderFileId: null,
          transferredBytes: 0n,
          completedAt: new Date(),
        },
      });

      await createAuditLog(
        job.userId,
        "TRANSFER_DELETE_COMPLETED",
        "transfer_job",
        jobId,
        {
          sourceAccountId: job.sourceAccountId,
          sizeBytes: "0",
        },
      );
      return;
    }

    await assertTransferCapacity(job.userId, job.sizeBytes);

    const result = await copyBetweenProviders({
      sourceAccount: job.sourceAccount,
      destAccount: job.destAccount,
      sourceProviderFileId: job.sourceProviderFileId,
      destParentId: job.destParentId,
      fileName: job.fileName,
    });

    const billedBytes =
      result.sizeBytes > 0n
        ? result.sizeBytes
        : job.sizeBytes > 0n
          ? job.sizeBytes
          : 0n;

    await recordTransferUsage(job.userId, billedBytes);

    const existingDest = await prisma.file.findFirst({
      where: {
        userId: job.userId,
        connectedAccountId: job.destAccountId,
        providerFileId: result.destProviderFileId,
      },
    });
    if (!existingDest) {
      await prisma.file.create({
        data: {
          userId: job.userId,
          connectedAccountId: job.destAccountId,
          provider: job.destAccount.provider,
          providerFileId: result.destProviderFileId,
          name: result.name,
          mimeType: result.mimeType,
          sizeBytes: billedBytes,
        },
      });
    }

    if (job.type === "move") {
      await deleteProviderFile({
        account: job.sourceAccount,
        providerFileId: job.sourceProviderFileId,
      });
      await prisma.file.updateMany({
        where: {
          userId: job.userId,
          connectedAccountId: job.sourceAccountId,
          providerFileId: job.sourceProviderFileId,
          status: "active",
        },
        data: { status: "deleted", deletedAt: new Date() },
      });
    }

    await prisma.transferJob.update({
      where: { id: jobId },
      data: {
        status: "completed",
        destProviderFileId: result.destProviderFileId,
        fileName: result.name,
        mimeType: result.mimeType,
        sizeBytes: billedBytes,
        transferredBytes: billedBytes,
        completedAt: new Date(),
      },
    });

    await createAuditLog(
      job.userId,
      job.type === "move"
        ? "TRANSFER_MOVE_COMPLETED"
        : "TRANSFER_COPY_COMPLETED",
      "transfer_job",
      jobId,
      {
        sourceAccountId: job.sourceAccountId,
        destAccountId: job.destAccountId,
        sizeBytes: billedBytes.toString(),
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Transfer failed unexpectedly.";
    await prisma.transferJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        errorMessage: message,
        completedAt: new Date(),
      },
    });

    const failedAction =
      job.type === "move"
        ? "TRANSFER_MOVE_FAILED"
        : job.type === "delete"
          ? "TRANSFER_DELETE_FAILED"
          : "TRANSFER_COPY_FAILED";
    await createAuditLog(job.userId, failedAction, "transfer_job", jobId, {
      message,
    });
  }
}

export function enqueueTransferJob(jobId: string) {
  void processTransferJob(jobId).catch((error) => {
    console.error(`Transfer job ${jobId} failed:`, error);
  });
}
