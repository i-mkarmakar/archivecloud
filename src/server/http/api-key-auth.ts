import { prisma } from "@/server/config/prisma";
import { hashToken, randomToken } from "@/server/utils/crypto";
import { errorJson } from "@/server/http/responses";
import { requireAuthUser, type AuthUser } from "@/server/http/auth";

export const API_KEY_SCOPES = [
  "accounts:read",
  "transfers:read",
  "transfers:write",
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export type AuthedPrincipal = AuthUser & {
  via: "session" | "api_key";
  apiKeyId?: string;
  scopes?: string[];
};

const KEY_PREFIX = "ack_";

export function generateApiKeySecret(): {
  rawKey: string;
  keyPrefix: string;
  keyHash: string;
} {
  const secret = randomToken(24);
  const rawKey = `${KEY_PREFIX}${secret}`;
  const keyPrefix = rawKey.slice(0, 12);
  return { rawKey, keyPrefix, keyHash: hashToken(rawKey) };
}

export async function resolveApiKeyFromRequest(
  request: Request,
): Promise<AuthedPrincipal | null> {
  const header = request.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  if (!token.startsWith(KEY_PREFIX)) return null;

  const keyHash = hashToken(token);
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
  });
  if (apiKey?.status !== "active") return null;
  if (apiKey.revokedAt) return null;
  if (apiKey.expiresAt && apiKey.expiresAt.getTime() < Date.now()) return null;

  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  const scopes = Array.isArray(apiKey.scopes)
    ? (apiKey.scopes as string[])
    : [];

  return {
    id: apiKey.userId,
    via: "api_key",
    apiKeyId: apiKey.id,
    scopes,
  };
}

export async function requireAuthUserOrApiKey(
  request: Request,
  requiredScopes: ApiKeyScope[] = [],
): Promise<AuthedPrincipal | Response> {
  const fromKey = await resolveApiKeyFromRequest(request);
  if (fromKey) {
    if (requiredScopes.length > 0) {
      const scopes = fromKey.scopes ?? [];
      const missing = requiredScopes.filter((s) => !scopes.includes(s));
      if (missing.length > 0) {
        return errorJson(
          "FORBIDDEN",
          `API key missing scopes: ${missing.join(", ")}`,
          403,
        );
      }
    }
    return fromKey;
  }

  const session = await requireAuthUser(request);
  if (session instanceof Response) return session;
  return { ...session, via: "session", scopes: [...API_KEY_SCOPES] };
}
