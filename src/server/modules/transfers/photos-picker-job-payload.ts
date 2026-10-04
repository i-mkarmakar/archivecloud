import "server-only";

import type { PickedMediaItem } from "@/server/modules/providers/google/google-photos-picker.service";

/**
 * ponytail: picker baseUrls live on the media item and expire; stash per job so
 * enqueueTransferJob can pull without a schema column. Lost on process restart —
 * user re-copies. Persistent job payload if we need multi-instance workers.
 */
const payloads = new Map<string, PickedMediaItem>();

export function stashPhotosPickerPayload(jobId: string, item: PickedMediaItem) {
  payloads.set(jobId, item);
}

export function takePhotosPickerPayload(
  jobId: string,
): PickedMediaItem | undefined {
  const item = payloads.get(jobId);
  if (item) payloads.delete(jobId);
  return item;
}
