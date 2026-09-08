import { z } from "zod";
import { prisma } from "@/server/config/prisma";
import { generateApiKeySecret } from "@/server/http/api-key-auth";
import { requireAuthUser } from "@/server/http/auth";
import { errorJson, json } from "@/server/http/responses";
import { createAuditLog } from "@/server/utils/audit";

function serializeApiKey(key: {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: unknown;
  status: string;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  revokedAt: Date | null;
}) {
  return {
    id: key.id,
    name: key.name,
    keyPrefix: key.keyPrefix,
    scopes: Array.isArray(key.scopes) ? key.scopes : [],
    status: key.status,
    lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
    expiresAt: key.expiresAt?.toISOString() ?? null,
    revokedAt: key.revokedAt?.toISOString() ?? null,
    createdAt: key.createdAt.toISOString(),
  };
}

export async function listApiKeysHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  const keys = await prisma.apiKey.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return json({ keys: keys.map(serializeApiKey) });
}

export async function createApiKeyHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  const body = z
    .object({
      name: z.string().trim().min(1).max(191),
      scopes: z
        .array(
          z.enum(["accounts:read", "transfers:read", "transfers:write"]),
        )
        .min(1)
        .default(["accounts:read", "transfers:read", "transfers:write"]),
      expiresInDays: z.number().int().min(1).max(365).optional(),
    })
    .parse(await request.json());

  const activeCount = await prisma.apiKey.count({
    where: { userId: user.id, status: "active", revokedAt: null },
  });
  if (activeCount >= 10) {
    return errorJson(
      "LIMIT_EXCEEDED",
      "You can have at most 10 active API keys.",
      400,
    );
  }

  const { rawKey, keyPrefix, keyHash } = generateApiKeySecret();
  const expiresAt = body.expiresInDays
    ? new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const key = await prisma.apiKey.create({
    data: {
      userId: user.id,
      name: body.name,
      keyPrefix,
      keyHash,
      scopes: body.scopes,
      status: "active",
      expiresAt,
    },
  });

  await createAuditLog(user.id, "API_KEY_CREATED", "api_key", key.id, {
    name: key.name,
    scopes: body.scopes,
  });

  return json(
    {
      key: serializeApiKey(key),
      
      secret: rawKey,
    },
    201,
  );
}

export async function revokeApiKeyHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const id = params?.id;
  if (!id) return errorJson("NOT_FOUND", "API key not found.", 404);

  const result = await prisma.apiKey.updateMany({
    where: { id, userId: user.id, status: "active" },
    data: {
      status: "revoked",
      revokedAt: new Date(),
    },
  });
  if (result.count === 0) {
    return errorJson("NOT_FOUND", "API key not found or already revoked.", 404);
  }

  await createAuditLog(user.id, "API_KEY_REVOKED", "api_key", id, {});
  return json({ status: "ok" });
}
