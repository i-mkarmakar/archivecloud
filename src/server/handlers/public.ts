import { z } from "zod";
import { prisma } from "@/server/config/prisma";
import { errorJson, json } from "@/server/http/responses";
import { enforcePublicShareRateLimit } from "@/server/modules/files/public-rate-limit";
import {
  assertShareBandwidthCapacity,
  meterShareBandwidthResponse,
} from "@/server/modules/files/share-bandwidth";
import { streamProviderFileResponse } from "@/server/modules/files/stream-file";
import { hashToken } from "@/server/utils/crypto";

const publicTokenSchema = z.string().min(1);

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
  if (share.file.connectedAccount?.status !== "connected") {
    return { kind: "missing" as const };
  }
  return {
    kind: "ok" as const,
    shareId: share.id,
    userId: share.userId,
    file: share.file,
    sharedBy: share.user,
  };
}

function parsePublicToken(params?: Record<string, string>) {
  const parsed = publicTokenSchema.safeParse(params?.token);
  if (!parsed.success) {
    return errorJson("SHARE_NOT_FOUND", "Shared file not found.", 404);
  }
  return parsed.data;
}

async function streamSharedBytes(
  result: Extract<Awaited<ReturnType<typeof findSharedFile>>, { kind: "ok" }>,
  request: Request,
  disposition: "inline" | "attachment",
) {
  const capped = await assertShareBandwidthCapacity({
    userId: result.userId,
    shareId: result.shareId,
  });
  if (capped) return capped;

  const response = await streamProviderFileResponse(
    result.file,
    request.headers.get("range") ?? undefined,
    { disposition, signal: request.signal },
  );
  return meterShareBandwidthResponse(response, {
    userId: result.userId,
    shareId: result.shareId,
  });
}

export async function getPublicFileHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const token = parsePublicToken(params);
  if (token instanceof Response) return token;
  const limited = enforcePublicShareRateLimit({ request, token });
  if (limited) return limited;
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
      sizeBytes: file.sizeBytes == null ? null : file.sizeBytes.toString(),
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
  const token = parsePublicToken(params);
  if (token instanceof Response) return token;
  const limited = enforcePublicShareRateLimit({ request, token });
  if (limited) return limited;
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
  return streamSharedBytes(result, request, "attachment");
}

export async function previewPublicFileHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const token = parsePublicToken(params);
  if (token instanceof Response) return token;
  const limited = enforcePublicShareRateLimit({ request, token });
  if (limited) return limited;
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
  return streamSharedBytes(result, request, "inline");
}
