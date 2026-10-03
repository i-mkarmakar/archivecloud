import { prisma } from "@/server/config/prisma";
import { errorJson } from "@/server/http/responses";

/** Block download/preview/share/transfer for Drive shortcuts. */
export function assertFileContentActionsAllowed(file: {
  isShortcut?: boolean;
  status?: string;
  deletedAt?: Date | null;
}): Response | null {
  if (file.isShortcut) {
    return errorJson(
      "SHORTCUT_NOT_SUPPORTED",
      "Shortcuts cannot be downloaded, previewed, shared, or transferred. Open the target file instead.",
      400,
    );
  }
  if (file.status === "deleted" || file.deletedAt) {
    return errorJson("FILE_NOT_FOUND", "File not found.", 404);
  }
  return null;
}

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
      connectedAccount: { status: "connected" },
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
      connectedAccount: { status: "connected" },
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
