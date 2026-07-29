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
  };
  folder?: { id: string; name: string } | null;
}) {
  return {
    ...file,
    sizeBytes: file.sizeBytes.toString(),
    starredAt: file.starredAt?.toISOString() ?? null,
    archivedAt: file.archivedAt?.toISOString() ?? null,
    lastAccessedAt: file.lastAccessedAt?.toISOString() ?? null,
    createdAt: file.createdAt.toISOString(),
    updatedAt: file.updatedAt.toISOString(),
    deletedAt: file.deletedAt?.toISOString() ?? null,
  };
}
