import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const envState = vi.hoisted(() => ({
  PUBLIC_SHARE_RATE_LIMIT_PER_IP: 2,
  PUBLIC_SHARE_RATE_LIMIT_PER_TOKEN: 2,
  PUBLIC_SHARE_RATE_WINDOW_MS: 60_000,
}));

vi.mock("@/server/config/env", () => ({
  env: envState,
}));

import {
  enforcePublicShareRateLimit,
  getClientIp,
  resetPublicShareRateLimitForTests,
} from "@/server/modules/files/public-rate-limit";

describe("enforcePublicShareRateLimit", () => {
  beforeEach(() => {
    resetPublicShareRateLimitForTests();
    envState.PUBLIC_SHARE_RATE_LIMIT_PER_IP = 2;
    envState.PUBLIC_SHARE_RATE_LIMIT_PER_TOKEN = 2;
  });

  it("allows under the limit and 429s with Retry-After when exceeded", async () => {
    const request = new Request("http://localhost/api/public/files/tok", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    expect(enforcePublicShareRateLimit({ request, token: "tok-a" })).toBeNull();
    expect(enforcePublicShareRateLimit({ request, token: "tok-a" })).toBeNull();
    const limited = enforcePublicShareRateLimit({ request, token: "tok-a" });
    expect(limited).toBeInstanceOf(Response);
    expect(limited?.status).toBe(429);
    expect(limited?.headers.get("Retry-After")).toBeTruthy();
    const body = await limited?.json();
    expect(body.code).toBe("RATE_LIMITED");
  });

  it("tracks IP separately from token", async () => {
    const ipA = new Request("http://localhost/x", {
      headers: { "x-forwarded-for": "10.0.0.1" },
    });
    const ipB = new Request("http://localhost/x", {
      headers: { "x-forwarded-for": "10.0.0.2" },
    });
    enforcePublicShareRateLimit({ request: ipA, token: "same" });
    enforcePublicShareRateLimit({ request: ipA, token: "same" });
    expect(
      enforcePublicShareRateLimit({ request: ipA, token: "same" })?.status,
    ).toBe(429);
    expect(
      enforcePublicShareRateLimit({ request: ipB, token: "other" }),
    ).toBeNull();
  });
});

describe("getClientIp", () => {
  it("uses first x-forwarded-for hop", () => {
    const request = new Request("http://localhost/x", {
      headers: { "x-forwarded-for": " 9.9.9.9 , 8.8.8.8" },
    });
    expect(getClientIp(request)).toBe("9.9.9.9");
  });
});
