import { describe, expect, it, vi } from "vitest";
import {
  classifyPublicStreamError,
  publicStreamErrorResponse,
} from "@/server/modules/files/public-stream-errors";

describe("classifyPublicStreamError", () => {
  it("maps Google quota and rate-limit errors", () => {
    expect(
      classifyPublicStreamError(new Error("downloadQuotaExceeded"), 403),
    ).toBe("rate_limited");
    expect(
      classifyPublicStreamError(new Error("userRateLimitExceeded"), 403),
    ).toBe("rate_limited");
    expect(classifyPublicStreamError(new Error("throttled"), 429)).toBe(
      "rate_limited",
    );
  });

  it("maps not found and unavailable", () => {
    expect(classifyPublicStreamError(new Error("missing"), 404)).toBe(
      "not_found",
    );
    expect(classifyPublicStreamError(new Error("backendError"), 503)).toBe(
      "unavailable",
    );
  });

  it("defaults to failed", () => {
    expect(classifyPublicStreamError(new Error("weird"), 500)).toBe("failed");
  });
});

describe("publicStreamErrorResponse", () => {
  it("never returns provider body text to the client", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = publicStreamErrorResponse(
      new Error('Dropbox download failed: {"error_summary":"secret path"}'),
      { httpStatus: 409 },
    );
    const body = await response.json();
    expect(response.status).toBe(502);
    expect(body.message).toBe("Failed to load this file.");
    expect(body.message).not.toMatch(/Dropbox|secret|error_summary/);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("sets Retry-After on rate limits", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = publicStreamErrorResponse(
      new Error("userRateLimitExceeded"),
      { httpStatus: 403 },
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    spy.mockRestore();
  });
});
