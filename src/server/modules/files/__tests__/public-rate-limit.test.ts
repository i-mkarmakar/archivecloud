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

vi.mock("@/server/config/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

import { prisma } from "@/server/config/prisma";
import {
  MemoryPublicShareRateLimitStore,
  PostgresPublicShareRateLimitStore,
} from "@/server/modules/files/public-rate-limit-store";
import {
  enforcePublicShareRateLimit,
  getClientIp,
  normalizeClientIp,
  resetPublicShareRateLimitForTests,
  setPublicShareRateLimitStoreForTests,
} from "@/server/modules/files/public-rate-limit";

describe("enforcePublicShareRateLimit", () => {
  beforeEach(() => {
    resetPublicShareRateLimitForTests();
    envState.PUBLIC_SHARE_RATE_LIMIT_PER_IP = 2;
    envState.PUBLIC_SHARE_RATE_LIMIT_PER_TOKEN = 2;
    envState.PUBLIC_SHARE_RATE_WINDOW_MS = 60_000;
    vi.mocked(prisma.$queryRaw).mockReset();
  });

  it("allows under the limit and 429s with Retry-After when exceeded", async () => {
    const request = new Request("http://localhost/api/public/files/tok", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    expect(
      await enforcePublicShareRateLimit({ request, token: "tok-a" }),
    ).toBeNull();
    expect(
      await enforcePublicShareRateLimit({ request, token: "tok-a" }),
    ).toBeNull();
    const limited = await enforcePublicShareRateLimit({
      request,
      token: "tok-a",
    });
    expect(limited).toBeInstanceOf(Response);
    expect(limited?.status).toBe(429);
    expect(limited?.headers.get("Retry-After")).toBeTruthy();
    const body = await limited?.json();
    expect(body.code).toBe("RATE_LIMITED");
    expect(body.message).toBe("Too many requests. Try again later.");
  });

  it("tracks IP separately from token across clients", async () => {
    const ipA = new Request("http://localhost/x", {
      headers: { "x-forwarded-for": "10.0.0.1" },
    });
    const ipB = new Request("http://localhost/x", {
      headers: { "x-forwarded-for": "10.0.0.2" },
    });
    await enforcePublicShareRateLimit({ request: ipA, token: "same" });
    await enforcePublicShareRateLimit({ request: ipA, token: "same" });
    expect(
      (await enforcePublicShareRateLimit({ request: ipA, token: "same" }))
        ?.status,
    ).toBe(429);
    expect(
      await enforcePublicShareRateLimit({ request: ipB, token: "other" }),
    ).toBeNull();
  });

  it("does not use User-Agent / Referer / Origin as rate-limit identity", async () => {
    envState.PUBLIC_SHARE_RATE_LIMIT_PER_IP = 1;
    envState.PUBLIC_SHARE_RATE_LIMIT_PER_TOKEN = 100;
    const base = {
      "x-forwarded-for": "203.0.113.10",
    };
    const a = new Request("http://localhost/x", {
      headers: { ...base, "user-agent": "A", referer: "https://a.test" },
    });
    const b = new Request("http://localhost/x", {
      headers: {
        ...base,
        "user-agent": "B",
        referer: "https://b.test",
        origin: "https://evil.test",
      },
    });
    expect(
      await enforcePublicShareRateLimit({ request: a, token: "t1" }),
    ).toBeNull();
    const limited = await enforcePublicShareRateLimit({
      request: b,
      token: "t2",
    });
    expect(limited?.status).toBe(429);
  });

  it("allows again after the fixed window rolls", async () => {
    const store = new MemoryPublicShareRateLimitStore();
    setPublicShareRateLimitStoreForTests(store);
    envState.PUBLIC_SHARE_RATE_LIMIT_PER_IP = 1;
    envState.PUBLIC_SHARE_RATE_LIMIT_PER_TOKEN = 100;
    envState.PUBLIC_SHARE_RATE_WINDOW_MS = 1_000;

    const request = new Request("http://localhost/x", {
      headers: { "x-forwarded-for": "198.51.100.1" },
    });
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(10_000);
    expect(
      await enforcePublicShareRateLimit({ request, token: "win" }),
    ).toBeNull();
    expect(
      (await enforcePublicShareRateLimit({ request, token: "win" }))?.status,
    ).toBe(429);

    // Next fixed window (windowMs = 1000)
    nowSpy.mockReturnValue(11_100);
    expect(
      await enforcePublicShareRateLimit({ request, token: "win" }),
    ).toBeNull();
    nowSpy.mockRestore();
  });

  it("enforces a global limit across two simulated app instances", async () => {
    const shared = new MemoryPublicShareRateLimitStore();
    envState.PUBLIC_SHARE_RATE_LIMIT_PER_IP = 3;
    envState.PUBLIC_SHARE_RATE_LIMIT_PER_TOKEN = 100;

    const request = new Request("http://localhost/x", {
      headers: { "x-forwarded-for": "192.0.2.10" },
    });

    async function hitAsInstance() {
      setPublicShareRateLimitStoreForTests(shared);
      return enforcePublicShareRateLimit({ request, token: "shared-tok" });
    }

    expect(await hitAsInstance()).toBeNull(); // instance A
    expect(await hitAsInstance()).toBeNull(); // instance B
    expect(await hitAsInstance()).toBeNull(); // instance A
    const limited = await hitAsInstance(); // either
    expect(limited?.status).toBe(429);
  });

  it("keeps the limit under concurrent hits", async () => {
    const store = new MemoryPublicShareRateLimitStore();
    setPublicShareRateLimitStoreForTests(store);
    envState.PUBLIC_SHARE_RATE_LIMIT_PER_IP = 5;
    envState.PUBLIC_SHARE_RATE_LIMIT_PER_TOKEN = 100;
    const request = new Request("http://localhost/x", {
      headers: { "x-forwarded-for": "192.0.2.55" },
    });

    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        enforcePublicShareRateLimit({ request, token: "burst" }),
      ),
    );
    const allowed = results.filter((r) => r === null).length;
    const limited = results.filter((r) => r?.status === 429).length;
    expect(allowed).toBe(5);
    expect(limited).toBe(15);
  });

  it("fail-closes with 503 when the store throws (no internal details)", async () => {
    setPublicShareRateLimitStoreForTests({
      hit: async () => {
        throw new Error("ECONNREFUSED redis://internal-secret:6379");
      },
    });
    const request = new Request("http://localhost/x", {
      headers: { "x-forwarded-for": "192.0.2.9" },
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const response = await enforcePublicShareRateLimit({
      request,
      token: "tok",
    });
    expect(response?.status).toBe(503);
    const body = await response?.json();
    expect(body.code).toBe("RATE_LIMITED");
    expect(JSON.stringify(body)).not.toContain("ECONNREFUSED");
    expect(JSON.stringify(body)).not.toContain("internal-secret");
    consoleError.mockRestore();
  });
});

describe("PostgresPublicShareRateLimitStore", () => {
  it("uses atomic upsert result for allow/deny", async () => {
    const store = new PostgresPublicShareRateLimitStore();
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([{ count: 1, window_start: new Date(0) }])
      .mockResolvedValueOnce([{ count: 3, window_start: new Date(0) }]);

    await expect(
      store.hit({ key: "ip:1.1.1.1", limit: 2, windowMs: 60_000, now: 1000 }),
    ).resolves.toEqual({ ok: true });
    await expect(
      store.hit({ key: "ip:1.1.1.1", limit: 2, windowMs: 60_000, now: 1000 }),
    ).resolves.toMatchObject({ ok: false });
  });
});

describe("getClientIp / normalizeClientIp", () => {
  it("uses first x-forwarded-for hop when valid", () => {
    const request = new Request("http://localhost/x", {
      headers: { "x-forwarded-for": " 9.9.9.9 , 8.8.8.8" },
    });
    expect(getClientIp(request)).toBe("9.9.9.9");
  });

  it("rejects malformed forwarded values", () => {
    expect(normalizeClientIp("not-an-ip")).toBeNull();
    expect(normalizeClientIp("1.2.3.4/24")).toBeNull();
    expect(normalizeClientIp("999.1.1.1")).toBeNull();
    expect(getClientIp(new Request("http://localhost/x"))).toBe("unknown");
    expect(
      getClientIp(
        new Request("http://localhost/x", {
          headers: { "x-forwarded-for": "totally-bogus" },
        }),
      ),
    ).toBe("unknown");
  });

  it("accepts IPv6", () => {
    expect(normalizeClientIp("2001:db8::1")).toBe("2001:db8::1");
  });
});
