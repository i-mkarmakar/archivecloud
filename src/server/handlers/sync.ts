import { z } from "zod";
import type { ConnectedAccount, FolderSync } from "@/generated/prisma/client";
import { prisma } from "@/server/config/prisma";
import { requireAuthUser } from "@/server/http/auth";
import { errorJson, json } from "@/server/http/responses";
import { requirePlanFeature } from "@/server/modules/billing/plan-gate";
import { isSupportedProvider } from "@/server/modules/providers/types";
import { computeFolderSyncContentHash } from "@/server/modules/sync/content-hash";
import {
  computeNextRunAt,
  runFolderSync,
} from "@/server/modules/sync/run-folder-sync";
import { createAuditLog } from "@/server/utils/audit";

const POLL_INTERVAL_MS = 5 * 60 * 1000;

type FolderSyncWithAccounts = FolderSync & {
  sourceAccount: ConnectedAccount;
  destAccount: ConnectedAccount;
};

function serializeFolderSync(
  sync: FolderSync & {
    sourceAccount: { email: string | null; displayName: string | null };
    destAccount: { email: string | null; displayName: string | null };
  },
) {
  return {
    id: sync.id,
    status: sync.status,
    direction: sync.direction,
    sourceAccountId: sync.sourceAccountId,
    destAccountId: sync.destAccountId,
    sourceParentId: sync.sourceParentId,
    destParentId: sync.destParentId,
    sourceLabel: sync.sourceLabel,
    destLabel: sync.destLabel,
    scheduleKind: sync.scheduleKind,
    pollEnabled: sync.pollEnabled,
    lastPolledAt: sync.lastPolledAt?.toISOString() ?? null,
    nextRunAt: sync.nextRunAt?.toISOString() ?? null,
    lastRunAt: sync.lastRunAt?.toISOString() ?? null,
    lastError: sync.lastError,
    createdAt: sync.createdAt.toISOString(),
    sourceAccountEmail: sync.sourceAccount.email,
    sourceAccountName: sync.sourceAccount.displayName,
    destAccountEmail: sync.destAccount.email,
    destAccountName: sync.destAccount.displayName,
  };
}

export async function listFolderSyncsHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  const syncs = await prisma.folderSync.findMany({
    where: {
      userId: user.id,
      status: { not: "deleted" },
    },
    include: {
      sourceAccount: { select: { email: true, displayName: true } },
      destAccount: { select: { email: true, displayName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return json({ syncs: syncs.map(serializeFolderSync) });
}

export async function createFolderSyncHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  const gated = await requirePlanFeature(
    user.id,
    "folderSync",
    "Folder sync is included with Thunder ($9 lifetime).",
  );
  if (gated) return gated;

  const body = z
    .object({
      sourceAccountId: z.string().min(1),
      destAccountId: z.string().min(1),
      sourceParentId: z.string().min(1).optional(),
      destParentId: z.string().min(1).optional(),
      sourceLabel: z.string().max(191).optional().nullable(),
      destLabel: z.string().max(191).optional().nullable(),
      scheduleKind: z
        .enum(["manual", "daily", "weekly", "auto"])
        .default("manual"),
      pollEnabled: z.boolean().optional(),
      direction: z.enum(["one_way", "two_way"]).default("one_way"),
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

  if (!sourceAccount) {
    return errorJson("ACCOUNT_NOT_FOUND", "Source account not found.", 404);
  }
  if (!destAccount) {
    return errorJson(
      "ACCOUNT_NOT_FOUND",
      "Destination account not found.",
      404,
    );
  }

  if (
    !isSupportedProvider(sourceAccount.provider) ||
    !isSupportedProvider(destAccount.provider)
  ) {
    return errorJson(
      "UNSUPPORTED_PROVIDER",
      "Folder sync requires supported cloud providers.",
      400,
    );
  }

  const scheduleKind = body.scheduleKind;
  const pollEnabled = body.pollEnabled ?? scheduleKind === "auto";
  const now = new Date();
  const nextRunAt =
    scheduleKind === "manual" || scheduleKind === "auto" ? null : now;

  const sync = await prisma.folderSync.create({
    data: {
      userId: user.id,
      status: "active",
      direction: body.direction,
      sourceAccountId: body.sourceAccountId,
      destAccountId: body.destAccountId,
      sourceParentId: body.sourceParentId ?? "root",
      destParentId: body.destParentId ?? "root",
      sourceLabel: body.sourceLabel ?? null,
      destLabel: body.destLabel ?? null,
      scheduleKind,
      pollEnabled,
      nextRunAt,
    },
  });

  await createAuditLog(user.id, "FOLDER_SYNC_CREATED", "folder_sync", sync.id, {
    sourceAccountId: sync.sourceAccountId,
    destAccountId: sync.destAccountId,
    scheduleKind: sync.scheduleKind,
  });

  return json({ syncId: sync.id }, 201);
}

export async function deleteFolderSyncHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const id = params?.id;
  if (!id) return errorJson("NOT_FOUND", "Folder sync not found.", 404);

  const result = await prisma.folderSync.updateMany({
    where: { id, userId: user.id, status: { not: "deleted" } },
    data: { status: "deleted" },
  });
  if (result.count === 0) {
    return errorJson("NOT_FOUND", "Folder sync not found.", 404);
  }

  await createAuditLog(user.id, "FOLDER_SYNC_DELETED", "folder_sync", id);
  return json({ status: "ok" });
}

export async function patchFolderSyncHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const id = params?.id;
  if (!id) return errorJson("NOT_FOUND", "Folder sync not found.", 404);

  const body = z
    .object({
      status: z.enum(["active", "paused"]).optional(),
      pollEnabled: z.boolean().optional(),
    })
    .refine(
      (value) => value.status !== undefined || value.pollEnabled !== undefined,
      {
        message: "Provide status and/or pollEnabled.",
      },
    )
    .parse(await request.json());

  const result = await prisma.folderSync.updateMany({
    where: {
      id,
      userId: user.id,
      status: { in: ["active", "paused"] },
    },
    data: {
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.pollEnabled !== undefined
        ? { pollEnabled: body.pollEnabled }
        : {}),
    },
  });
  if (result.count === 0) {
    return errorJson("NOT_FOUND", "Folder sync not found.", 404);
  }

  if (body.status !== undefined) {
    await createAuditLog(
      user.id,
      body.status === "paused" ? "FOLDER_SYNC_PAUSED" : "FOLDER_SYNC_RESUMED",
      "folder_sync",
      id,
    );
  }
  if (body.pollEnabled !== undefined) {
    await createAuditLog(
      user.id,
      body.pollEnabled
        ? "FOLDER_SYNC_POLL_ENABLED"
        : "FOLDER_SYNC_POLL_DISABLED",
      "folder_sync",
      id,
    );
  }

  return json({
    ...(body.status !== undefined ? { status: body.status } : {}),
    ...(body.pollEnabled !== undefined
      ? { pollEnabled: body.pollEnabled }
      : {}),
  });
}

export async function runFolderSyncHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const id = params?.id;
  if (!id) return errorJson("NOT_FOUND", "Folder sync not found.", 404);

  const sync = await prisma.folderSync.findFirst({
    where: {
      id,
      userId: user.id,
      status: { in: ["active", "paused"] },
    },
  });
  if (!sync) {
    return errorJson("NOT_FOUND", "Folder sync not found.", 404);
  }

  try {
    const result = await runFolderSync(id, { manual: true });
    return json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Folder sync run failed.";
    return errorJson("FOLDER_SYNC_FAILED", message, 500);
  }
}

async function processFolderSyncTick(
  sync: FolderSyncWithAccounts,
  now: Date,
  options: { scheduleDue: boolean; pollDue: boolean },
): Promise<{ ran: boolean; queuedJobs: number }> {
  let contentHash: string | null = null;
  try {
    contentHash = await computeFolderSyncContentHash({
      direction: sync.direction,
      sourceAccount: sync.sourceAccount,
      destAccount: sync.destAccount,
      userId: sync.userId,
      sourceParentId: sync.sourceParentId,
      destParentId: sync.destParentId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Content hash check failed.";
    await prisma.folderSync.update({
      where: { id: sync.id },
      data: {
        lastError: message,
        ...(options.pollDue ? { lastPolledAt: now } : {}),
      },
    });
    return { ran: false, queuedJobs: 0 };
  }

  const unchanged =
    sync.lastContentHash !== null && contentHash === sync.lastContentHash;

  if (options.pollDue) {
    await prisma.folderSync.update({
      where: { id: sync.id },
      data: { lastPolledAt: now },
    });
  }

  const shouldRunOnChange =
    options.pollDue ||
    (options.scheduleDue &&
      (sync.scheduleKind === "daily" || sync.scheduleKind === "weekly"));

  if (unchanged && shouldRunOnChange) {
    if (options.scheduleDue) {
      await prisma.folderSync.update({
        where: { id: sync.id },
        data: { nextRunAt: computeNextRunAt(sync.scheduleKind, now) },
      });
    }
    return { ran: false, queuedJobs: 0 };
  }

  if (unchanged && !shouldRunOnChange) {
    return { ran: false, queuedJobs: 0 };
  }

  try {
    const result = await runFolderSync(sync.id);
    return { ran: true, queuedJobs: result.queuedJobs };
  } catch {
    if (options.scheduleDue) {
      await prisma.folderSync.update({
        where: { id: sync.id },
        data: { nextRunAt: computeNextRunAt(sync.scheduleKind, now) },
      });
    }
    return { ran: false, queuedJobs: 0 };
  }
}

async function collectDueFolderSyncs(options: {
  userId?: string;
  pollLimit: number;
  scheduleLimit: number;
}) {
  const now = new Date();
  const pollCutoff = new Date(now.getTime() - POLL_INTERVAL_MS);
  const userFilter = options.userId ? { userId: options.userId } : {};

  const [pollDueSyncs, scheduleDueSyncs] = await Promise.all([
    prisma.folderSync.findMany({
      where: {
        ...userFilter,
        status: "active",
        pollEnabled: true,
        OR: [{ lastPolledAt: null }, { lastPolledAt: { lte: pollCutoff } }],
      },
      include: { sourceAccount: true, destAccount: true },
      orderBy: { lastPolledAt: "asc" },
      take: options.pollLimit,
    }),
    prisma.folderSync.findMany({
      where: {
        ...userFilter,
        status: "active",
        scheduleKind: { in: ["daily", "weekly"] },
        nextRunAt: { lte: now },
      },
      include: { sourceAccount: true, destAccount: true },
      orderBy: { nextRunAt: "asc" },
      take: options.scheduleLimit,
    }),
  ]);

  return { now, pollDueSyncs, scheduleDueSyncs };
}

async function runFolderSyncTickBatch(options: {
  userId?: string;
  pollLimit: number;
  scheduleLimit: number;
}) {
  const { now, pollDueSyncs, scheduleDueSyncs } =
    await collectDueFolderSyncs(options);

  const syncsById = new Map<string, FolderSyncWithAccounts>();
  for (const sync of pollDueSyncs) {
    syncsById.set(sync.id, sync);
  }
  for (const sync of scheduleDueSyncs) {
    syncsById.set(sync.id, sync);
  }

  const pollDueIds = new Set(pollDueSyncs.map((sync) => sync.id));
  const scheduleDueIds = new Set(scheduleDueSyncs.map((sync) => sync.id));

  let processedSyncs = 0;
  let queuedJobs = 0;
  let ranSyncs = 0;

  for (const sync of syncsById.values()) {
    processedSyncs += 1;
    const result = await processFolderSyncTick(sync, now, {
      pollDue: pollDueIds.has(sync.id),
      scheduleDue: scheduleDueIds.has(sync.id),
    });
    if (result.ran) ranSyncs += 1;
    queuedJobs += result.queuedJobs;
  }

  return { processedSyncs, ranSyncs, queuedJobs };
}

export async function tickFolderSyncsGlobal(options?: { limit?: number }) {
  const limit = options?.limit ?? 20;
  return runFolderSyncTickBatch({
    pollLimit: Math.ceil(limit / 2),
    scheduleLimit: Math.ceil(limit / 2),
  });
}

export async function tickFolderSyncsHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  const result = await runFolderSyncTickBatch({
    userId: user.id,
    pollLimit: 5,
    scheduleLimit: 5,
  });
  return json(result);
}
