import { prisma } from "@/server/config/prisma";
import { errorJson } from "@/server/http/responses";

const BLOCKED_REASON_MESSAGES: Record<string, string> = {
  shortcut:
    "Shortcuts cannot be downloaded, previewed, shared, or transferred. Open the target file instead.",
  paper:
    "Dropbox Paper documents cannot be downloaded or shared through Archive Cloud.",
  not_downloadable:
    "This file is not downloadable from the provider and cannot be previewed, shared, or transferred.",
  shared_folder:
    "Shared-folder mounts cannot be downloaded, previewed, shared, or transferred.",
  remote_item:
    "Remote / shared items cannot be downloaded, previewed, shared, or transferred.",
  team_namespace:
    "Team-namespace items are not supported for download, preview, share, or transfer.",
};

/** Block download/preview/share/transfer for shortcuts and provider-blocked items. */
export function assertFileContentActionsAllowed(file: {
  isShortcut?: boolean;
  blockedReason?: string | null;
  status?: string;
  deletedAt?: Date | null;
}): Response | null {
  const reason = file.blockedReason?.trim() || null;
  if (reason) {
    return errorJson(
      "CONTENT_BLOCKED",
      BLOCKED_REASON_MESSAGES[reason] ??
        "This file cannot be downloaded, previewed, shared, or transferred.",
      400,
    );
  }
  if (file.isShortcut) {
    return errorJson(
      "SHORTCUT_NOT_SUPPORTED",
      BLOCKED_REASON_MESSAGES.shortcut,
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
