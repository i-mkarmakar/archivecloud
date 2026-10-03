import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/server/config/prisma", () => ({
  prisma: {},
}));

import { assertFileContentActionsAllowed } from "@/server/lib/file-access";

describe("assertFileContentActionsAllowed", () => {
  it("blocks shortcuts", async () => {
    const response = assertFileContentActionsAllowed({ isShortcut: true });
    expect(response).toBeInstanceOf(Response);
    expect(response?.status).toBe(400);
    const body = await response?.json();
    expect(body.code).toBe("SHORTCUT_NOT_SUPPORTED");
  });

  it("blocks by blockedReason", async () => {
    const response = assertFileContentActionsAllowed({
      blockedReason: "paper",
    });
    expect(response?.status).toBe(400);
    const body = await response?.json();
    expect(body.code).toBe("CONTENT_BLOCKED");
  });

  it("blocks soft-deleted files", async () => {
    const response = assertFileContentActionsAllowed({
      status: "deleted",
      deletedAt: new Date(),
    });
    expect(response?.status).toBe(404);
  });

  it("allows normal active files", () => {
    expect(
      assertFileContentActionsAllowed({
        isShortcut: false,
        status: "active",
        deletedAt: null,
      }),
    ).toBeNull();
  });
});
