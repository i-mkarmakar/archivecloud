import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  requireAuthUser: vi.fn(),
  findMany: vi.fn(),
  setPassword: vi.fn(),
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

vi.mock("@/server/http/auth", () => ({
  requireAuthUser: mocks.requireAuthUser,
}));

vi.mock("@/server/config/prisma", () => ({
  prisma: {
    account: { findMany: mocks.findMany },
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      setPassword: mocks.setPassword,
    },
  },
}));

import { setPasswordHandler } from "@/server/handlers/account";

describe("setPasswordHandler password policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthUser.mockResolvedValue({ id: "user-1", email: "a@b.c" });
    mocks.findMany.mockResolvedValue([{ providerId: "google" }]);
    mocks.setPassword.mockResolvedValue({});
  });

  it("rejects passwords shorter than 8 with VALIDATION_ERROR", async () => {
    const response = await setPasswordHandler(
      new Request("http://localhost/account/set-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ newPassword: "short7!" }),
      }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.message).toBe("Password must be between 8 and 128 characters.");
    expect(mocks.setPassword).not.toHaveBeenCalled();
  });

  it("rejects passwords longer than 128", async () => {
    const response = await setPasswordHandler(
      new Request("http://localhost/account/set-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ newPassword: "a".repeat(129) }),
      }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(JSON.stringify(body)).not.toContain("a".repeat(20));
    expect(mocks.setPassword).not.toHaveBeenCalled();
  });

  it("accepts an 8-character password and calls Better Auth", async () => {
    const response = await setPasswordHandler(
      new Request("http://localhost/account/set-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ newPassword: "abcdefgh" }),
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.setPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { newPassword: "abcdefgh" },
      }),
    );
  });

  it("does not leak Better Auth errors to the client", async () => {
    mocks.setPassword.mockRejectedValue(
      new Error("Prisma: connection to postgres://secret@db failed"),
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const response = await setPasswordHandler(
      new Request("http://localhost/account/set-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ newPassword: "abcdefgh" }),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.code).toBe("SET_PASSWORD_FAILED");
    expect(JSON.stringify(body)).not.toContain("postgres://");
    expect(JSON.stringify(body)).not.toContain("secret");
    consoleError.mockRestore();
  });
});
