import { describe, expect, it } from "vitest";
import { resolveContentLengthHeader } from "@/server/modules/files/content-length";

describe("resolveContentLengthHeader", () => {
  it("prefers provider Content-Length over metadata size", () => {
    expect(
      resolveContentLengthHeader({
        providerContentLength: "10",
        sizeBytes: 99n,
      }),
    ).toBe("10");
  });

  it("falls back to metadata sizeBytes when provider omits length", () => {
    expect(
      resolveContentLengthHeader({
        providerContentLength: null,
        sizeBytes: 42n,
      }),
    ).toBe("42");
  });

  it("omits header when neither is available", () => {
    expect(resolveContentLengthHeader({})).toBeNull();
  });
});
