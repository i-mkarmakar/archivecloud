import { prisma } from "@/server/config/prisma";
import { hashToken } from "@/server/utils/crypto";
import type { AuthUser } from "./auth";
import { errorJson } from "./responses";

export type ApiKeyContext = {
  user: AuthUser;
  apiKey: { id: string; scopes: string[] };
};

function normalizeScopes(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export async function requireApiKeyUser(
  request: Request,
  scope: string,
): Promise<ApiKeyContext | Response> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer "))
    return errorJson("API_KEY_REQUIRED", "API key required.", 401);
  const rawKey = header.slice(7).trim();
  try {
    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash: hashToken(rawKey) },
    });
    if (
      apiKey?.status !== "active" ||
      apiKey.revokedAt ||
      (apiKey.expiresAt && apiKey.expiresAt <= new Date())
    ) {
      return errorJson("API_KEY_INVALID", "Invalid API key.", 401);
    }
    const scopes = normalizeScopes(apiKey.scopes);
    if (!scopes.includes(scope))
      return errorJson(
        "API_KEY_FORBIDDEN",
        "API key does not have required scope.",
        403,
      );
    await prisma.apiKey
      .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);
    return {
      user: { id: apiKey.userId, clerkUserId: `api-key:${apiKey.id}` },
      apiKey: { id: apiKey.id, scopes },
    };
  } catch {
    return errorJson("API_KEY_INVALID", "Invalid API key.", 401);
  }
}

export function isApiKeyContext(
  value: ApiKeyContext | Response,
): value is ApiKeyContext {
  return typeof value === "object" && "user" in value && "apiKey" in value;
}
