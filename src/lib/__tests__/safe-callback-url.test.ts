import { describe, expect, it } from "vitest";
import {
  isAuthEntryPath,
  normalizeAppPath,
  safeCallbackUrl,
} from "@/lib/safe-callback-url";

describe("safeCallbackUrl", () => {
  it("defaults to /home when missing", () => {
    expect(safeCallbackUrl(null)).toBe("/home");
    expect(safeCallbackUrl(undefined)).toBe("/home");
    expect(safeCallbackUrl("")).toBe("/home");
  });

  it("accepts same-origin app paths", () => {
    expect(safeCallbackUrl("/home")).toBe("/home");
    expect(safeCallbackUrl("/shared")).toBe("/shared");
    expect(safeCallbackUrl("/billing/history")).toBe("/billing/history");
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(safeCallbackUrl("https://malicious.example")).toBe("/home");
    expect(safeCallbackUrl("http://evil.test/phish")).toBe("/home");
    expect(safeCallbackUrl("//evil.test/phish")).toBe("/home");
    expect(safeCallbackUrl("evil.test")).toBe("/home");
  });

  it("never returns auth entry aliases as destinations", () => {
    expect(safeCallbackUrl("/login")).toBe("/home");
    expect(safeCallbackUrl("/signin")).toBe("/home");
    expect(safeCallbackUrl("/signup")).toBe("/home");
    expect(safeCallbackUrl("/auth/sign-in")).toBe("/home");
    expect(safeCallbackUrl("/auth/sign-up")).toBe("/home");
    expect(safeCallbackUrl("/verify-email")).toBe("/home");
    expect(safeCallbackUrl("/google-auth")).toBe("/home");
  });

  it("supports empty fallback for proxy callback omission", () => {
    expect(safeCallbackUrl("/login", "")).toBe("");
    expect(safeCallbackUrl("/", "")).toBe("");
    expect(safeCallbackUrl("/home", "")).toBe("/home");
  });
});

describe("isAuthEntryPath", () => {
  it("detects auth aliases", () => {
    expect(isAuthEntryPath("/login")).toBe(true);
    expect(isAuthEntryPath("/auth/sign-in")).toBe(true);
    expect(isAuthEntryPath("/home")).toBe(false);
  });
});

describe("normalizeAppPath", () => {
  it("strips locale prefixes", () => {
    expect(normalizeAppPath("/en/home")).toBe("/home");
  });
});
