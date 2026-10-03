import type { Readable } from "node:stream";

/** Abort upstream work when the client disconnects (request.signal). */
export function onClientAbort(
  signal: AbortSignal | undefined,
  onAbort: () => void,
): void {
  if (!signal) return;
  if (signal.aborted) {
    onAbort();
    return;
  }
  signal.addEventListener("abort", onAbort, { once: true });
}

/** Destroy a Node readable when the client aborts. */
export function destroyStreamOnAbort(
  stream: Readable,
  signal: AbortSignal | undefined,
): void {
  onClientAbort(signal, () => {
    stream.destroy();
  });
}

/** Cancel a web ReadableStream when the client aborts. */
export function cancelWebStreamOnAbort(
  body: ReadableStream<Uint8Array> | null,
  signal: AbortSignal | undefined,
): void {
  if (!body) return;
  onClientAbort(signal, () => {
    void body.cancel().catch(() => undefined);
  });
}
