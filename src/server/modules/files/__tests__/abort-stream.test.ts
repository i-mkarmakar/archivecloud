import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  destroyStreamOnAbort,
  onClientAbort,
} from "@/server/modules/files/abort-stream";

vi.mock("server-only", () => ({}));

const getRequestHeaders = vi.fn(async () => ({ Authorization: "Bearer t" }));

vi.mock("@/server/modules/providers/google/google.service", () => ({
  getAuthedGoogleClient: vi.fn(async () => ({
    getRequestHeaders,
  })),
}));

import { streamGoogleFileResponse } from "@/server/modules/providers/google/drive-stream";

describe("onClientAbort", () => {
  it("runs immediately when already aborted", () => {
    const controller = new AbortController();
    controller.abort();
    const onAbort = vi.fn();
    onClientAbort(controller.signal, onAbort);
    expect(onAbort).toHaveBeenCalledTimes(1);
  });

  it("runs when signal aborts later", () => {
    const controller = new AbortController();
    const onAbort = vi.fn();
    onClientAbort(controller.signal, onAbort);
    expect(onAbort).not.toHaveBeenCalled();
    controller.abort();
    expect(onAbort).toHaveBeenCalledTimes(1);
  });
});

describe("destroyStreamOnAbort", () => {
  it("destroys the node stream on abort", () => {
    const stream = new Readable({
      read() {
        this.push(Buffer.from("x"));
        this.push(null);
      },
    });
    const destroy = vi.spyOn(stream, "destroy");
    const controller = new AbortController();
    destroyStreamOnAbort(stream, controller.signal);
    controller.abort();
    expect(destroy).toHaveBeenCalled();
  });
});

describe("streamGoogleFileResponse abort", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes request AbortSignal to the upstream Google fetch", async () => {
    let seenSignal: AbortSignal | null | undefined;
    vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
      seenSignal = init?.signal;
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-length": "3" },
      });
    });

    const controller = new AbortController();
    await streamGoogleFileResponse(
      {
        name: "a.bin",
        mimeType: "application/octet-stream",
        providerFileId: "file-1",
        connectedAccount: { id: "acct" },
      } as never,
      undefined,
      { disposition: "attachment", signal: controller.signal },
    );

    expect(seenSignal).toBe(controller.signal);
    vi.unstubAllGlobals();
  });
});
