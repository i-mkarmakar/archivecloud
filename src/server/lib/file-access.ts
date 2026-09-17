import { prisma } from "@/server/config/prisma";

export async function getAccessibleFile(
  userId: string,
  fileId: string,
  options: {
    write?: boolean;
    includeFolder?: boolean;
    activeOnly?: boolean;
  } = {},
) {
  const { write = false, includeFolder = false, activeOnly = false } = options;

  const include = {
    connectedAccount: true as const,
    ...(includeFolder
      ? { folder: { select: { id: true as const, name: true as const } } }
      : {}),
  };

  const owned = await prisma.file.findFirst({
    where: {
      id: fileId,
      userId,
      ...(activeOnly ? { status: "active" as const } : {}),
    },
    include,
  });
  if (owned) return owned;

  if (write) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user?.email) return null;

  const file = await prisma.file.findFirst({
    where: {
      id: fileId,
      status: "active",
    },
    include,
  });
  if (!file) return null;

  const invite = await prisma.workspaceInvite.findFirst({
    where: {
      inviteeEmail: user.email,
      revokedAt: null,
      OR: [
        { targetType: "file", targetId: fileId },
        ...(file.folderId
          ? [{ targetType: "folder" as const, targetId: file.folderId }]
          : []),
      ],
    },
  });
  if (!invite) return null;

  return file;
}
