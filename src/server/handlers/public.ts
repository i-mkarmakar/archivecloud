import { prisma } from "@/server/config/prisma";
import { errorJson, json } from "@/server/http/responses";
import { streamProviderFileResponse } from "@/server/modules/files/stream-file";
import { hashToken } from "@/server/utils/crypto";

async function findSharedFile(token: string) {
  const share = await prisma.fileShare.findFirst({
    where: {
      tokenHash: hashToken(token),
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: {
      file: { include: { connectedAccount: true } },
      user: { select: { name: true, image: true } },
    },
  });
  if (!share) return { kind: "missing" as const };
  if (!share.enabled) return { kind: "disabled" as const };
  if (share.file.status !== "active") return { kind: "missing" as const };
  return {
    kind: "ok" as const,
    file: share.file,
    sharedBy: share.user,
  };
}

export async function getPublicFileHandler(
  _request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const token = params?.token;
  if (!token)
    return errorJson("SHARE_NOT_FOUND", "Shared file not found.", 404);
  const result = await findSharedFile(token);
  if (result.kind === "disabled") {
    return errorJson(
      "SHARE_DISABLED",
      "This public link is currently unavailable.",
      403,
    );
  }
  if (result.kind !== "ok") {
    return errorJson("SHARE_NOT_FOUND", "Shared file not found.", 404);
  }
  const file = result.file;
  return json({
    file: {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes.toString(),
      createdAt: file.createdAt,
      provider: file.provider,
      sharedBy: {
        name: result.sharedBy?.name?.trim() || "Archive Cloud user",
        image: result.sharedBy?.image ?? null,
      },
    },
  });
}

export async function downloadPublicFileHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const token = params?.token;
  if (!token)
    return errorJson("SHARE_NOT_FOUND", "Shared file not found.", 404);
  const result = await findSharedFile(token);
  if (result.kind === "disabled") {
    return errorJson(
      "SHARE_DISABLED",
      "This public link is currently unavailable.",
      403,
    );
  }
  if (result.kind !== "ok") {
    return errorJson("SHARE_NOT_FOUND", "Shared file not found.", 404);
  }
  return streamProviderFileResponse(
    result.file,
    request.headers.get("range") ?? undefined,
    { disposition: "attachment" },
  );
}

export async function previewPublicFileHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const token = params?.token;
  if (!token)
    return errorJson("SHARE_NOT_FOUND", "Shared file not found.", 404);
  const result = await findSharedFile(token);
  if (result.kind === "disabled") {
    return errorJson(
      "SHARE_DISABLED",
      "This public link is currently unavailable.",
      403,
    );
  }
  if (result.kind !== "ok") {
    return errorJson("SHARE_NOT_FOUND", "Shared file not found.", 404);
  }
  return streamProviderFileResponse(
    result.file,
    request.headers.get("range") ?? undefined,
    { disposition: "inline" },
  );
}
