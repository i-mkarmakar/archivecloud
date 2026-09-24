import { beforeEach, vi } from "vitest";
import { handleRoute } from "@/server/http/responses";

vi.mock("server-only", () => ({}));

vi.mock("@/server/config/env", () => ({
  env: {
    APP_URL: "http://localhost:9050",
    TOKEN_ENCRYPTION_KEY: "test-encryption-key-32-characters!!",
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    MAX_UPLOAD_BYTES: 5 * 1024 * 1024 * 1024,
  },
}));

const { requireAuthUser, prismaMock } = vi.hoisted(() => {
  const requireAuthUser = vi.fn();
  const prismaMock = {
    file: {
      findFirst: vi.fn(),
      findFirstOrThrow: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    folder: {
      findFirst: vi.fn(),
      findFirstOrThrow: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    fileShare: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    connectedAccount: {
      findFirst: vi.fn(),
      findFirstOrThrow: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    transferJob: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    uploadSession: {
      findFirstOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    uploadRoutingPolicy: {
      upsert: vi.fn(),
      update: vi.fn(),
    },
    workspaceInvite: {
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };
  return { requireAuthUser, prismaMock };
});

vi.mock("@/server/http/auth", () => ({
  requireAuthUser,
}));

vi.mock("@/server/config/prisma", () => ({
  prisma: prismaMock,
}));

export { prismaMock, requireAuthUser };

export function authed(userId = "user-1") {
  requireAuthUser.mockResolvedValue({ id: userId });
}

export function unauthenticated() {
  requireAuthUser.mockResolvedValue(
    Response.json(
      { code: "AUTH_REQUIRED", message: "Sign in required." },
      { status: 401 },
    ),
  );
}

export function asRoute(
  handler: (
    request: Request,
    user?: unknown,
    params?: Record<string, string>,
  ) => Promise<Response>,
) {
  return handleRoute((request, params) => handler(request, undefined, params));
}

export async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

export function jsonRequest(
  url: string,
  body?: unknown,
  init?: RequestInit,
): Request {
  return new Request(url, {
    method: init?.method ?? (body === undefined ? "GET" : "POST"),
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    ...init,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.auditLog.create.mockResolvedValue({});
  prismaMock.workspaceInvite.findMany.mockResolvedValue([]);
});
