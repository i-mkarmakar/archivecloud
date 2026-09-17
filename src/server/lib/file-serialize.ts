import { prisma } from "@/server/config/prisma";
import { createAuditLog } from "@/server/utils/audit";

export async function touchFileAccess(
  userId: string,
  fileId: string,
  action: "PREVIEW_FILE" | "DOWNLOAD_FILE",
) {
  await prisma.file.updateMany({
    where: { id: fileId, userId, status: "active" },
    data: { lastAccessedAt: new Date() },
  });
  await createAuditLog(userId, action, "file", fileId, {});
}

export function serializeFile(file: {
  id: string;
  userId: string;
  connectedAccountId: string;
  folderId: string | null;
  provider: string;
  providerFileId: string;
  name: string;
  mimeType: string;
  sizeBytes: bigint;
  checksum: string | null;
  status: string;
  isStarred: boolean;
  starredAt: Date | null;
  isArchived: boolean;
  archivedAt: Date | null;
  lastAccessedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  connectedAccount?: {
    id: string;
    email: string;
    provider: string;
    displayName?: string | null;
    avatarUrl?: string | null;
  };
  folder?: { id: string; name: string } | null;
  tags?: Array<{ id: string; name: string; color: string }>;
}) {
  return {
    id: file.id,
    userId: file.userId,
    connectedAccountId: file.connectedAccountId,
    folderId: file.folderId,
    provider: file.provider,
    providerFileId: file.providerFileId,
    name: file.name,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes.toString(),
    checksum: file.checksum,
    status: file.status,
    isStarred: file.isStarred,
    starredAt: file.starredAt?.toISOString() ?? null,
    archivedAt: file.archivedAt?.toISOString() ?? null,
    isArchived: file.isArchived,
    lastAccessedAt: file.lastAccessedAt?.toISOString() ?? null,
    createdAt: file.createdAt.toISOString(),
    updatedAt: file.updatedAt.toISOString(),
    deletedAt: file.deletedAt?.toISOString() ?? null,
    connectedAccount: file.connectedAccount
      ? {
          id: file.connectedAccount.id,
          email: file.connectedAccount.email,
          provider: file.connectedAccount.provider,
          displayName: file.connectedAccount.displayName ?? null,
          avatarUrl: file.connectedAccount.avatarUrl ?? null,
        }
      : undefined,
    folder: file.folder ?? null,
    tags: file.tags?.map((tag) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
    })),
  };
}
