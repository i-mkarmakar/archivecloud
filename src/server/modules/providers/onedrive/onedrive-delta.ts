import "server-only";

import type { ConnectedAccount } from "@/generated/prisma/client";
import { IndexRateLimitedError } from "@/server/modules/indexing/catalog-upsert";
import { getOneDriveAccessToken } from "@/server/modules/onedrive/onedrive.service";

const GRAPH = "https://graph.microsoft.com/v1.0";
const MAX_RETRIES = 6;

export type OneDriveDeltaItem = {
  id?: string;
  name?: string;
  size?: number;
  file?: { mimeType?: string } | null;
  folder?: Record<string, unknown> | null;
  root?: Record<string, unknown> | null;
  deleted?: { state?: string } | null;
  remoteItem?: {
    id?: string;
    name?: string;
    parentReference?: { driveId?: string } | null;
  } | null;
  parentReference?: {
    id?: string;
    driveId?: string;
    path?: string;
  } | null;
};

export type OneDriveDeltaPage = {
  value: OneDriveDeltaItem[];
  nextLink: string | null;
  deltaLink: string | null;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isOneDriveResyncRequiredError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /410|resyncRequired|resyncChanges/i.test(message);
}

export function isOneDriveAuthError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /token refresh failed|access token missing|refresh token|invalid_grant|401|unauthorized/i.test(
    message,
  );
}

/**
 * GET /me/drive/root/delta or follow an absolute nextLink/deltaLink URL.
 * Honors 429/503 Retry-After with bounded retries.
 * @see https://learn.microsoft.com/en-us/graph/api/driveitem-delta
 */
export async function fetchOneDriveDeltaPage(
  account: ConnectedAccount,
  pageToken: string | null,
): Promise<OneDriveDeltaPage> {
  let attempt = 0;
  for (;;) {
    const accessToken = await getOneDriveAccessToken(account);
    const url =
      pageToken && /^https?:\/\//i.test(pageToken)
        ? pageToken
        : `${GRAPH}/me/drive/root/delta${
            pageToken ? `?token=${encodeURIComponent(pageToken)}` : ""
          }`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.status === 429 || response.status === 503) {
      attempt += 1;
      if (attempt > MAX_RETRIES) {
        throw new IndexRateLimitedError(
          `OneDrive delta throttled after ${MAX_RETRIES} retries (${response.status}).`,
        );
      }
      const retryAfter = Number(response.headers.get("retry-after"));
      const delay = Number.isFinite(retryAfter)
        ? Math.min(60_000, Math.max(500, retryAfter * 1000))
        : Math.min(30_000, 500 * 2 ** (attempt - 1));
      await sleep(delay);
      continue;
    }

    if (response.status === 410) {
      const text = await response.text().catch(() => "");
      throw new Error(`OneDrive delta 410 resyncRequired: ${text}`);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new Error(`OneDrive delta failed (${response.status}): ${text}`);
    }

    const data = (await response.json()) as {
      value?: OneDriveDeltaItem[];
      "@odata.nextLink"?: string;
      "@odata.deltaLink"?: string;
    };

    return {
      value: data.value ?? [],
      nextLink: data["@odata.nextLink"] ?? null,
      deltaLink: data["@odata.deltaLink"] ?? null,
    };
  }
}
