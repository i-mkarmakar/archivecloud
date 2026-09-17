import type { ConnectedAccount } from "@/generated/prisma/client";
import { prisma } from "@/server/config/prisma";
import {
  browseProviderFolder,
  ensureProviderChildFolder,
} from "@/server/modules/providers/operations";
import {
  computeFolderSyncContentHash,
  MAX_SYNC_FOLDERS,
} from "@/server/modules/sync/content-hash";
import { enqueueTransferJob } from "@/server/modules/transfers/process-job";
import { createAuditLog } from "@/server/utils/audit";

export function computeNextRunAt(
  scheduleKind: string,
  from: Date,
): Date | null {
  if (scheduleKind === "manual" || scheduleKind === "auto") return null;
  const d = new Date(from);
  if (scheduleKind === "daily") {
    d.setDate(d.getDate() + 1);
    return d;
  }
  if (scheduleKind === "weekly") {
    d.setDate(d.getDate() + 7);
    return d;
  }
  return null;
}

function normalizeDestParentId(parentId: string): string | null {
  const trimmed = parentId.trim();
  if (!trimmed || trimmed === "root") return null;
  return trimmed;
}

const MAX_SYNC_FILES = 1000;

async function syncOneDirection(params: {
  userId: string;
  sourceAccount: ConnectedAccount;
  destAccount: ConnectedAccount;
  sourceRootId: string;
  destRootId: string;
  limits: { foldersVisited: number; queuedJobs: number };
}): Promise<{
  queuedJobs: number;
  foldersVisited: number;
  foldersCreated: number;
}> {
  let queuedJobs = 0;
  let foldersVisited = 0;
  let foldersCreated = 0;

  type QueueItem = { sourceParentId: string; destParentId: string };
  const queue: QueueItem[] = [
    {
      sourceParentId: params.sourceRootId || "root",
      destParentId: params.destRootId || "root",
    },
  ];

  while (queue.length > 0) {
    if (params.limits.foldersVisited + foldersVisited >= MAX_SYNC_FOLDERS) {
      throw new Error(
        `Folder sync stopped after ${MAX_SYNC_FOLDERS} folders. Narrow the source folder.`,
      );
    }
    if (params.limits.queuedJobs + queuedJobs >= MAX_SYNC_FILES) {
      throw new Error(
        `Folder sync queued ${MAX_SYNC_FILES} files (limit). Re-run to continue.`,
      );
    }

    const current = queue.shift()!;
    foldersVisited += 1;

    const sourceBrowse = await browseProviderFolder(
      params.sourceAccount,
      params.userId,
      current.sourceParentId,
    );
    const destBrowse = await browseProviderFolder(
      params.destAccount,
      params.userId,
      current.destParentId,
    );

    const destFileNames = new Set(
      destBrowse.files.map((file) => file.name.toLowerCase()),
    );
    const destFoldersByName = new Map(
      destBrowse.folders.map((folder) => [
        folder.name.toLowerCase(),
        folder.id,
      ]),
    );

    for (const file of sourceBrowse.files) {
      if (params.limits.queuedJobs + queuedJobs >= MAX_SYNC_FILES) break;
      if (destFileNames.has(file.name.toLowerCase())) continue;

      const job = await prisma.transferJob.create({
        data: {
          userId: params.userId,
          type: "copy",
          status: "queued",
          sourceAccountId: params.sourceAccount.id,
          destAccountId: params.destAccount.id,
          sourceProviderFileId: file.id,
          destParentId: normalizeDestParentId(current.destParentId),
          fileName: file.name,
          mimeType: file.mimeType,
          sizeBytes: BigInt(file.sizeBytes),
        },
      });

      enqueueTransferJob(job.id);
      queuedJobs += 1;
    }

    for (const folder of sourceBrowse.folders) {
      if (
        params.limits.foldersVisited + foldersVisited + queue.length >=
        MAX_SYNC_FOLDERS
      ) {
        break;
      }

      let destFolderId = destFoldersByName.get(folder.name.toLowerCase());
      if (!destFolderId) {
        destFolderId = await ensureProviderChildFolder(
          params.destAccount,
          current.destParentId,
          folder.name,
        );
        foldersCreated += 1;
        destFoldersByName.set(folder.name.toLowerCase(), destFolderId);
      }

      queue.push({
        sourceParentId: folder.id,
        destParentId: destFolderId,
      });
    }
  }

  return { queuedJobs, foldersVisited, foldersCreated };
}

export async function runFolderSync(
  syncId: string,
  options?: { manual?: boolean },
) {
  const sync = await prisma.folderSync.findUnique({
    where: { id: syncId },
    include: {
      sourceAccount: true,
      destAccount: true,
    },
  });
  if (!sync) throw new Error("Folder sync not found.");
  if (sync.status !== "active" && !options?.manual) {
    throw new Error("Folder sync is not active.");
  }
  if (sync.status === "deleted") {
    throw new Error("Folder sync was deleted.");
  }

  const now = new Date();
  const limits = { foldersVisited: 0, queuedJobs: 0 };
  let foldersCreated = 0;

  try {
    if (
      sync.sourceAccount.status !== "connected" ||
      sync.destAccount.status !== "connected"
    ) {
      throw new Error("Source or destination account is disconnected.");
    }

    const forward = await syncOneDirection({
      userId: sync.userId,
      sourceAccount: sync.sourceAccount,
      destAccount: sync.destAccount,
      sourceRootId: sync.sourceParentId,
      destRootId: sync.destParentId,
      limits,
    });
    limits.queuedJobs += forward.queuedJobs;
    limits.foldersVisited += forward.foldersVisited;
    foldersCreated += forward.foldersCreated;

    if (sync.direction === "two_way") {
      const reverse = await syncOneDirection({
        userId: sync.userId,
        sourceAccount: sync.destAccount,
        destAccount: sync.sourceAccount,
        sourceRootId: sync.destParentId,
        destRootId: sync.sourceParentId,
        limits,
      });
      limits.queuedJobs += reverse.queuedJobs;
      limits.foldersVisited += reverse.foldersVisited;
      foldersCreated += reverse.foldersCreated;
    }

    const contentHash = await computeFolderSyncContentHash({
      direction: sync.direction,
      sourceAccount: sync.sourceAccount,
      destAccount: sync.destAccount,
      userId: sync.userId,
      sourceParentId: sync.sourceParentId,
      destParentId: sync.destParentId,
    });

    await prisma.folderSync.update({
      where: { id: syncId },
      data: {
        lastRunAt: now,
        lastError: null,
        lastContentHash: contentHash,
        nextRunAt: computeNextRunAt(sync.scheduleKind, now),
      },
    });

    await createAuditLog(
      sync.userId,
      "FOLDER_SYNC_RUN",
      "folder_sync",
      syncId,
      {
        direction: sync.direction,
        queuedJobs: limits.queuedJobs,
        foldersVisited: limits.foldersVisited,
        foldersCreated,
      },
    );

    return {
      queuedJobs: limits.queuedJobs,
      foldersVisited: limits.foldersVisited,
      foldersCreated,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Folder sync failed.";
    await prisma.folderSync.update({
      where: { id: syncId },
      data: {
        lastRunAt: now,
        lastError: message,
      },
    });
    throw error;
  }
}
