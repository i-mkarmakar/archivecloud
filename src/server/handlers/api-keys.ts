import { z } from "zod";
import { prisma } from "@/server/config/prisma";
import { requireAuthUser } from "@/server/http/auth";
import { errorJson, json } from "@/server/http/responses";
import { requireDeveloperMode } from "@/server/lib/require-developer-mode";
import { hashToken, randomToken } from "@/server/utils/crypto";

const createSchema = z.object({
  name: z.string().trim().min(1).max(191),
  expiresAt: z.string().datetime().nullable().optional(),
});
const scopes = ["files:upload"];

function serializeApiKey(apiKey: {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: unknown;
  status: string;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: apiKey.id,
    name: apiKey.name,
    keyPrefix: apiKey.keyPrefix,
    scopes: Array.isArray(apiKey.scopes) ? apiKey.scopes : [],
    status: apiKey.status,
    lastUsedAt: apiKey.lastUsedAt?.toISOString() ?? null,
    expiresAt: apiKey.expiresAt?.toISOString() ?? null,
    revokedAt: apiKey.revokedAt?.toISOString() ?? null,
    createdAt: apiKey.createdAt.toISOString(),
  };
}

export async function listApiKeysHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const denied = await requireDeveloperMode(user);
  if (denied) return denied;
  const apiKeys = await prisma.apiKey.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return json({ apiKeys: apiKeys.map(serializeApiKey) });
}

export async function createApiKeyHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const denied = await requireDeveloperMode(user);
  if (denied) return denied;
  const body = createSchema.parse(await request.json());
  const secret = `9d_live_${randomToken(32)}`;
  const apiKey = await prisma.apiKey.create({
    data: {
      userId: user.id,
      name: body.name,
      keyPrefix: secret.slice(0, 16),
      keyHash: hashToken(secret),
      scopes,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    },
  });
  return json({ apiKey: serializeApiKey(apiKey), secret }, 201);
}

export async function revokeApiKeyHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const denied = await requireDeveloperMode(user);
  if (denied) return denied;
  const id = params?.id;
  if (!id) return errorJson("VALIDATION_ERROR", "API key id required.", 400);
  await prisma.apiKey.updateMany({
    where: { id, userId: user.id, revokedAt: null },
    data: { status: "revoked", revokedAt: new Date() },
  });
  return json({ status: "ok" });
}
