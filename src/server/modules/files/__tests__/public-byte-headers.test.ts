import { describe, expect, it } from "vitest";
import {
  applyPublicByteSafetyHeaders,
  isInlineAllowedMime,
  resolvePublicContentDisposition,
} from "@/server/modules/files/public-byte-headers";

describe("isInlineAllowedMime", () => {
  it("allows images except SVG, PDF, audio, video", () => {
    expect(isInlineAllowedMime("image/png")).toBe(true);
    expect(isInlineAllowedMime("image/jpeg")).toBe(true);
    expect(isInlineAllowedMime("application/pdf")).toBe(true);
    expect(isInlineAllowedMime("audio/mpeg")).toBe(true);
    expect(isInlineAllowedMime("video/mp4")).toBe(true);
    expect(isInlineAllowedMime("image/svg+xml")).toBe(false);
    expect(isInlineAllowedMime("text/html")).toBe(false);
    expect(isInlineAllowedMime("text/plain")).toBe(false);
    expect(isInlineAllowedMime("application/javascript")).toBe(false);
  });
});

describe("resolvePublicContentDisposition", () => {
  it("forces attachment for non-allowlisted types even when inline preferred", () => {
    expect(resolvePublicContentDisposition("inline", "text/html")).toBe(
      "attachment",
    );
    expect(resolvePublicContentDisposition("inline", "image/svg+xml")).toBe(
      "attachment",
    );
    expect(resolvePublicContentDisposition("inline", "image/png")).toBe(
      "inline",
    );
    expect(resolvePublicContentDisposition("attachment", "image/png")).toBe(
      "attachment",
    );
  });

  it("does not trust bare provider-like claims without allowlist", () => {
    expect(
      resolvePublicContentDisposition("inline", "text/html; charset=utf-8"),
    ).toBe("attachment");
  });
});

describe("applyPublicByteSafetyHeaders", () => {
  it("sets nosniff, CSP sandbox, and disposition", () => {
    const headers = new Headers();
    applyPublicByteSafetyHeaders(headers, {
      mimeType: "image/png",
      fileName: 'photo".png',
      preferredDisposition: "inline",
    });
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Content-Security-Policy")).toMatch(/sandbox/);
    expect(headers.get("Content-Disposition")).toBe(
      'inline; filename="photo.png"',
    );
    expect(headers.get("Content-Type")).toBe("image/png");
  });

  it("forces attachment for SVG", () => {
    const headers = new Headers();
    applyPublicByteSafetyHeaders(headers, {
      mimeType: "image/svg+xml",
      fileName: "x.svg",
      preferredDisposition: "inline",
    });
    expect(headers.get("Content-Disposition")).toMatch(/^attachment/);
  });
});
