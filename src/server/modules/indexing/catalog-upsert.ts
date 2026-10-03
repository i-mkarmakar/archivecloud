import "server-only";

import { prisma } from "@/server/config/prisma";

export const GOOGLE_FOLDER_MIME = "application/vnd.google-apps.folder";
export const GOOGLE_SHORTCUT_MIME = "application/vnd.google-apps.shortcut";

export type CatalogIndexItem = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: bigint | null;
  providerParentId: string | null;
  providerPathLower?: string | null;
  isFolder: boolean;
  isShortcut: boolean;
  shortcutTargetId: string | null;
};

/** Thrown when provider rate limits are exhausted — scan should pause, not fail. */
export class IndexRateLimitedError extends Error {
  constructor(message = "INDEX_RATE_LIMITED") {
    super(message);
    this.name = "IndexRateLimitedError";
  }
}

export class IndexWriteAbortedError extends Error {
  constructor(message = "INDEX_WRITE_ABORTED") {
    super(message);
    this.name = "IndexWriteAbortedError";
  }
}

export function mapGoogleFileToCatalogItem(file: {
  id?: string | null;
  name?: string | null;
  mimeType?: string | null;
  size?: string | null;
  parents?: string[] | null;
  shortcutDetails?: { targetId?: string | null } | null;
}): CatalogIndexItem | null {
  if (!file.id || !file.name || !file.mimeType) return null;
  const isFolder = file.mimeType === GOOGLE_FOLDER_MIME;
  const isShortcut = file.mimeType === GOOGLE_SHORTCUT_MIME;
  const sizeRaw = file.size;
  const sizeBytes =
    sizeRaw == null || sizeRaw === ""
      ? null
      : (() => {
          try {
            return BigInt(sizeRaw);
          } catch {
            return null;
          }
        })();
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    sizeBytes,
    providerParentId: file.parents?.[0] ?? null,
    providerPathLower: null,
    isFolder,
    isShortcut,
    shortcutTargetId: isShortcut
      ? (file.shortcutDetails?.targetId ?? null)
      : null,
  };
}

/** Disable shares, delete preview tokens, revoke workspace invites. */
export async function revokeFileShareAndPreviewAccess(fileIds: string[]) {
  if (fileIds.length === 0) return;
  await prisma.fileShare.updateMany({
    where: { fileId: { in: fileIds }, enabled: true },
    data: { enabled: false },
  });
  await prisma.filePreviewToken.deleteMany({
    where: { fileId: { in: fileIds } },
  });
  await prisma.workspaceInvite.updateMany({
    where: {
      targetType: "file",
      targetId: { in: fileIds },
      revokedAt: null,
    },
    data: { revokedAt: new Date(), status: "revoked" },
  });
}

async function softDeleteFileIds(ids: string[]) {
  if (ids.length === 0) return;
  await prisma.file.updateMany({
    where: { id: { in: ids } },
    data: { status: "deleted", deletedAt: new Date() },
  });
  await revokeFileShareAndPreviewAccess(ids);
}

/**
 * Soft-delete catalog row. Preserves stars/archive/tags/folderId/VF links.
 * Revokes shares, preview tokens, and workspace invites.
 */
export async function softDeleteCatalogFile(params: {
  connectedAccountId: string;
  providerFileId: string;
}) {
  const rows = await prisma.file.findMany({
    where: {
      connectedAccountId: params.connectedAccountId,
      providerFileId: params.providerFileId,
      status: "active",
    },
    select: { id: true },
  });
  if (rows.length === 0) return;
  await softDeleteFileIds(rows.map((row) => row.id));
}

/** Soft-delete a path and all descendants (Dropbox folder delete semantics). */
export async function softDeleteCatalogByPathPrefix(params: {
  connectedAccountId: string;
  pathLower: string;
}): Promise<number> {
  const path = params.pathLower.replace(/\/+$/, "").toLowerCase();
  if (!path) return 0;
  const rows = await prisma.file.findMany({
    where: {
      connectedAccountId: params.connectedAccountId,
      status: "active",
      OR: [
        { providerPathLower: path },
        { providerPathLower: { startsWith: `${path}/` } },
      ],
    },
    select: { id: true },
  });
  if (rows.length === 0) return 0;
  await softDeleteFileIds(rows.map((r) => r.id));
  return rows.length;
}

export async function softDeleteCatalogFilesWhere(where: {
  connectedAccountId: string;
  status: "active";
  deletedAt: null;
  createdAt: { lt: Date };
  updatedAt: { lt: Date };
  OR: Array<{ lastIndexScanId: null } | { lastIndexScanId: { not: string } }>;
}): Promise<number> {
  const rows = await prisma.file.findMany({
    where,
    select: { id: true },
  });
  if (rows.length === 0) return 0;
  const ids = rows.map((row) => row.id);
  await softDeleteFileIds(ids);
  return ids.length;
}

function upsertArgs(params: {
  userId: string;
  connectedAccountId: string;
  provider: string;
  item: CatalogIndexItem;
  lastIndexScanId?: string | null;
}) {
  const { item } = params;
  return {
    where: {
      connectedAccountId_providerFileId: {
        connectedAccountId: params.connectedAccountId,
        providerFileId: item.id,
      },
    },
    create: {
      userId: params.userId,
      connectedAccountId: params.connectedAccountId,
      provider: params.provider,
      providerFileId: item.id,
      providerParentId: item.providerParentId,
      providerPathLower: item.providerPathLower ?? null,
      isFolder: item.isFolder,
      isShortcut: item.isShortcut,
      shortcutTargetId: item.shortcutTargetId,
      name: item.name.slice(0, 255),
      mimeType: item.mimeType,
      sizeBytes: item.sizeBytes,
      status: "active" as const,
      lastIndexScanId: params.lastIndexScanId ?? null,
    },
    update: {
      name: item.name.slice(0, 255),
      mimeType: item.mimeType,
      sizeBytes: item.sizeBytes,
      providerParentId: item.providerParentId,
      providerPathLower: item.providerPathLower ?? null,
      isFolder: item.isFolder,
      isShortcut: item.isShortcut,
      shortcutTargetId: item.shortcutTargetId,
      status: "active" as const,
      deletedAt: null,
      ...(params.lastIndexScanId !== undefined
        ? { lastIndexScanId: params.lastIndexScanId }
        : {}),
    },
  };
}

/**
 * Upsert catalog metadata. Restores soft-deleted rows without wiping
 * star/archive/folderId/tags. Does not re-enable revoked shares/invites.
 */
export async function upsertCatalogItem(params: {
  userId: string;
  connectedAccountId: string;
  provider: string;
  item: CatalogIndexItem;
  lastIndexScanId?: string | null;
}) {
  await prisma.file.upsert(upsertArgs(params));
}

/**
 * Full-scan page write: account must still be connected with matching scanId
 * in the same transaction as file upserts/removes (disconnect-safe).
 */
export async function writeFullScanPageGuarded(params: {
  userId: string;
  connectedAccountId: string;
  provider: string;
  scanId: string;
  items: CatalogIndexItem[];
  removedProviderFileIds?: string[];
  removedPathPrefixes?: string[];
  indexFilesIndexed: number;
  indexPageToken: string | null;
}): Promise<"ok" | "aborted"> {
  try {
    await prisma.$transaction(async (tx) => {
      const lock = await tx.connectedAccount.updateMany({
        where: {
          id: params.connectedAccountId,
          status: "connected",
          indexScanId: params.scanId,
        },
        data: {
          indexStatus: "running",
          indexHeartbeatAt: new Date(),
          indexFilesIndexed: params.indexFilesIndexed,
          indexPageToken: params.indexPageToken,
        },
      });
      if (lock.count === 0) {
        throw new IndexWriteAbortedError();
      }

      for (const item of params.items) {
        await tx.file.upsert(
          upsertArgs({
            userId: params.userId,
            connectedAccountId: params.connectedAccountId,
            provider: params.provider,
            item,
            lastIndexScanId: params.scanId,
          }),
        );
      }

      const removedIds = params.removedProviderFileIds ?? [];
      if (removedIds.length > 0) {
        const rows = await tx.file.findMany({
          where: {
            connectedAccountId: params.connectedAccountId,
            providerFileId: { in: removedIds },
            status: "active",
          },
          select: { id: true },
        });
        if (rows.length > 0) {
          const ids = rows.map((r) => r.id);
          await tx.file.updateMany({
            where: { id: { in: ids } },
            data: { status: "deleted", deletedAt: new Date() },
          });
          await tx.fileShare.updateMany({
            where: { fileId: { in: ids }, enabled: true },
            data: { enabled: false },
          });
          await tx.filePreviewToken.deleteMany({
            where: { fileId: { in: ids } },
          });
          await tx.workspaceInvite.updateMany({
            where: {
              targetType: "file",
              targetId: { in: ids },
              revokedAt: null,
            },
            data: { revokedAt: new Date(), status: "revoked" },
          });
        }
      }

      for (const pathLower of params.removedPathPrefixes ?? []) {
        const path = pathLower.replace(/\/+$/, "").toLowerCase();
        if (!path) continue;
        const rows = await tx.file.findMany({
          where: {
            connectedAccountId: params.connectedAccountId,
            status: "active",
            OR: [
              { providerPathLower: path },
              { providerPathLower: { startsWith: `${path}/` } },
            ],
          },
          select: { id: true },
        });
        if (rows.length === 0) continue;
        const ids = rows.map((r) => r.id);
        await tx.file.updateMany({
          where: { id: { in: ids } },
          data: { status: "deleted", deletedAt: new Date() },
        });
        await tx.fileShare.updateMany({
          where: { fileId: { in: ids }, enabled: true },
          data: { enabled: false },
        });
        await tx.filePreviewToken.deleteMany({
          where: { fileId: { in: ids } },
        });
        await tx.workspaceInvite.updateMany({
          where: {
            targetType: "file",
            targetId: { in: ids },
            revokedAt: null,
          },
          data: { revokedAt: new Date(), status: "revoked" },
        });
      }

      // Heal Dropbox path-placeholder parents once the folder id is known.
      for (const item of params.items) {
        if (!item.isFolder || !item.providerPathLower) continue;
        await tx.file.updateMany({
          where: {
            connectedAccountId: params.connectedAccountId,
            providerParentId: `path:${item.providerPathLower}`,
          },
          data: { providerParentId: item.id },
        });
      }
    });
    return "ok";
  } catch (error) {
    if (error instanceof IndexWriteAbortedError) return "aborted";
    throw error;
  }
}

/**
 * Incremental batch: verify connected in the same transaction as ops + token.
 */
export async function writeIncrementalBatchGuarded(params: {
  userId: string;
  connectedAccountId: string;
  provider: string;
  ops: Array<
    | { type: "upsert"; item: CatalogIndexItem }
    | { type: "remove"; providerFileId: string }
    | { type: "remove_path_prefix"; pathLower: string }
  >;
  nextChangesToken: string;
}): Promise<"ok" | "aborted"> {
  try {
    await prisma.$transaction(async (tx) => {
      for (const op of params.ops) {
        if (op.type === "remove_path_prefix") {
          const path = op.pathLower.replace(/\/+$/, "").toLowerCase();
          if (!path) continue;
          const rows = await tx.file.findMany({
            where: {
              connectedAccountId: params.connectedAccountId,
              status: "active",
              OR: [
                { providerPathLower: path },
                { providerPathLower: { startsWith: `${path}/` } },
              ],
            },
            select: { id: true },
          });
          if (rows.length === 0) continue;
          const ids = rows.map((r) => r.id);
          await tx.file.updateMany({
            where: { id: { in: ids } },
            data: { status: "deleted", deletedAt: new Date() },
          });
          await tx.fileShare.updateMany({
            where: { fileId: { in: ids }, enabled: true },
            data: { enabled: false },
          });
          await tx.filePreviewToken.deleteMany({
            where: { fileId: { in: ids } },
          });
          await tx.workspaceInvite.updateMany({
            where: {
              targetType: "file",
              targetId: { in: ids },
              revokedAt: null,
            },
            data: { revokedAt: new Date(), status: "revoked" },
          });
          continue;
        }
        if (op.type === "remove") {
          const rows = await tx.file.findMany({
            where: {
              connectedAccountId: params.connectedAccountId,
              providerFileId: op.providerFileId,
              status: "active",
            },
            select: { id: true },
          });
          if (rows.length === 0) continue;
          const ids = rows.map((r) => r.id);
          await tx.file.updateMany({
            where: { id: { in: ids } },
            data: { status: "deleted", deletedAt: new Date() },
          });
          await tx.fileShare.updateMany({
            where: { fileId: { in: ids }, enabled: true },
            data: { enabled: false },
          });
          await tx.filePreviewToken.deleteMany({
            where: { fileId: { in: ids } },
          });
          await tx.workspaceInvite.updateMany({
            where: {
              targetType: "file",
              targetId: { in: ids },
              revokedAt: null,
            },
            data: { revokedAt: new Date(), status: "revoked" },
          });
          continue;
        }
        await tx.file.upsert(
          upsertArgs({
            userId: params.userId,
            connectedAccountId: params.connectedAccountId,
            provider: params.provider,
            item: op.item,
          }),
        );
      }

      for (const op of params.ops) {
        if (
          op.type !== "upsert" ||
          !op.item.isFolder ||
          !op.item.providerPathLower
        ) {
          continue;
        }
        await tx.file.updateMany({
          where: {
            connectedAccountId: params.connectedAccountId,
            providerParentId: `path:${op.item.providerPathLower}`,
          },
          data: { providerParentId: op.item.id },
        });
      }

      // Commit token only if still connected — else roll back the batch.
      const lock = await tx.connectedAccount.updateMany({
        where: {
          id: params.connectedAccountId,
          status: "connected",
        },
        data: { indexChangesPageToken: params.nextChangesToken },
      });
      if (lock.count === 0) {
        throw new IndexWriteAbortedError();
      }
    });
    return "ok";
  } catch (error) {
    if (error instanceof IndexWriteAbortedError) return "aborted";
    throw error;
  }
}
