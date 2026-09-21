import { prisma } from "@/server/config/prisma";
import { errorJson, json } from "@/server/http/responses";
import { streamProviderFileResponse } from "@/server/modules/files/stream-file";
import { hashToken } from "@/server/utils/crypto";

async function findSharedFile(token: string) {
  const share = await prisma.fileShare.findFirst({
    where: {
      enabled: true,
      tokenHash: hashToken(token),
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: { file: { include: { connectedAccount: true } } },
  });
  if (share?.file.status !== "active") return null;
  return share.file;
}

export async function getPublicFileHandler(
  _request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const token = params?.token;
  if (!token)
    return errorJson("SHARE_NOT_FOUND", "Shared file not found.", 404);
  const file = await findSharedFile(token);
  if (!file) return errorJson("SHARE_NOT_FOUND", "Shared file not found.", 404);
  return json({
    file: {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes.toString(),
      createdAt: file.createdAt,
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
  const file = await findSharedFile(token);
  if (!file) return errorJson("SHARE_NOT_FOUND", "Shared file not found.", 404);
  return streamProviderFileResponse(
    file,
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
  const file = await findSharedFile(token);
  if (!file) return errorJson("SHARE_NOT_FOUND", "Shared file not found.", 404);
  return streamProviderFileResponse(
    file,
    request.headers.get("range") ?? undefined,
    { disposition: "inline" },
  );
}
