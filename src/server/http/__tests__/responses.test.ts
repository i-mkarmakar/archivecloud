import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AppHttpError } from "@/server/http/app-error";
import {
  errorJson,
  handleRoute,
  PUBLIC_INTERNAL_ERROR_MESSAGE,
  PUBLIC_VALIDATION_ERROR_MESSAGE,
} from "@/server/http/responses";

describe("errorJson", () => {
  it("returns explicitly controlled public errors unchanged", async () => {
    const response = errorJson("AUTH_REQUIRED", "Sign in required.", 401);
    const body = (await response.json()) as { code: string; message: string };
    expect(response.status).toBe(401);
    expect(body).toEqual({
      code: "AUTH_REQUIRED",
      message: "Sign in required.",
    });
  });
});

describe("handleRoute", () => {
  it("hides unexpected Error.message from clients and logs internals", async () => {
    const secret = "DATABASE CONNECTION STRING: secret-internal-detail";
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const route = handleRoute(async () => {
      throw new Error(secret);
    });

    const response = await route(
      new Request("http://localhost/files", { method: "GET" }),
    );
    const body = (await response.json()) as { code: string; message: string };

    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_SERVER_ERROR");
    expect(body.message).toBe(PUBLIC_INTERNAL_ERROR_MESSAGE);
    expect(JSON.stringify(body)).not.toContain(secret);
    expect(consoleError).toHaveBeenCalled();
    const logged = consoleError.mock.calls[0];
    expect(logged?.[0]).toBe("[handleRoute]");
    expect(logged?.[1]).toMatchObject({
      method: "GET",
      path: "/files",
      message: secret,
    });
    consoleError.mockRestore();
  });

  it("returns a safe VALIDATION_ERROR for ZodError without schema dump", async () => {
    const schema = z.object({
      category: z.enum(["Spam or misleading", "Other"]),
      email: z.string().email(),
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const route = handleRoute(async () => {
      schema.parse({});
      return new Response(null);
    });

    const response = await route(
      new Request("http://localhost/api/report-abuse", { method: "POST" }),
    );
    const body = (await response.json()) as { code: string; message: string };
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(400);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.message).toBe(PUBLIC_VALIDATION_ERROR_MESSAGE);
    expect(serialized).not.toContain("Spam or misleading");
    expect(serialized).not.toContain("invalid_value");
    expect(serialized).not.toContain("expected");
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("does not rewrite successful handler responses", async () => {
    const route = handleRoute(async () =>
      Response.json({ ok: true }, { status: 200 }),
    );
    const response = await route(new Request("http://localhost/health"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("preserves intentional errorJson from handlers", async () => {
    const route = handleRoute(async () =>
      errorJson("FILE_NOT_FOUND", "File not found.", 404),
    );
    const response = await route(new Request("http://localhost/files/x"));
    const body = (await response.json()) as { code: string; message: string };
    expect(response.status).toBe(404);
    expect(body).toEqual({
      code: "FILE_NOT_FOUND",
      message: "File not found.",
    });
  });

  it("maps AppHttpError to its controlled public code/message", async () => {
    const route = handleRoute(async () => {
      throw new AppHttpError(
        "NOT_SUPPORTED",
        "Upload is not supported for iCloud Drive.",
        400,
      );
    });
    const response = await route(new Request("http://localhost/uploads"));
    const body = (await response.json()) as { code: string; message: string };
    expect(response.status).toBe(400);
    expect(body).toEqual({
      code: "NOT_SUPPORTED",
      message: "Upload is not supported for iCloud Drive.",
    });
  });
});
