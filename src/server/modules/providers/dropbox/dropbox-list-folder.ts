import "server-only";

import type { ConnectedAccount } from "@/generated/prisma/client";
import { IndexRateLimitedError } from "@/server/modules/indexing/catalog-upsert";
import { getDropboxAccessToken } from "@/server/modules/dropbox/dropbox.service";

const DROPBOX_API = "https://api.dropboxapi.com/2";
const MAX_RETRIES = 6;

export type DropboxListEntry = {
  ".tag": "file" | "folder" | "deleted";
  name: string;
  path_display?: string;
  path_lower?: string;
  id?: string;
  size?: number;
  is_downloadable?: boolean;
  sharing_info?: {
    read_only?: boolean;
    /** Present on the shared folder mount itself. */
    shared_folder_id?: string;
    /** Present on items inside a shared folder (not the mount alone). */
    parent_shared_folder_id?: string;
    traverse_only?: boolean;
    no_access?: boolean;
  };
};

export type DropboxListFolderPage = {
  entries: DropboxListEntry[];
  cursor: string;
  hasMore: boolean;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isDropboxResetCursorError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /"\.tag"\s*:\s*"reset"|reset["\s]|cursor.*reset/i.test(message);
}

export function isDropboxAuthError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /access token missing|refresh token|invalid_access_token|expired_access_token|401|unauthorized/i.test(
    message,
  );
}

export function isDropboxRateLimitedError(error: unknown): boolean {
  if (error instanceof IndexRateLimitedError) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /too_many_requests|rate.?limit|429/i.test(message);
}

/**
 * Recursive list_folder / list_folder/continue page.
 * @see https://www.dropbox.com/developers/documentation/http/documentation#files-list_folder
 */
export async function fetchDropboxListFolderPage(
  account: ConnectedAccount,
  params: {
    /** null = start recursive list at root; else continue cursor */
    cursor: string | null;
    includeDeleted?: boolean;
  },
): Promise<DropboxListFolderPage> {
  let attempt = 0;
  for (;;) {
    const accessToken = await getDropboxAccessToken(account);
    const path = params.cursor
      ? "/files/list_folder/continue"
      : "/files/list_folder";
    const body = params.cursor
      ? { cursor: params.cursor }
      : {
          path: "",
          recursive: true,
          include_deleted: Boolean(params.includeDeleted),
          include_mounted_folders: true,
          include_non_downloadable_files: true,
          limit: 500,
        };

    const response = await fetch(`${DROPBOX_API}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (response.status === 429 || response.status === 503) {
      attempt += 1;
      if (attempt > MAX_RETRIES) {
        throw new IndexRateLimitedError(
          `Dropbox rate limited after ${MAX_RETRIES} retries (${response.status}).`,
        );
      }
      const retryAfter = Number(response.headers.get("retry-after"));
      const delay = Number.isFinite(retryAfter)
        ? Math.min(60_000, Math.max(500, retryAfter * 1000))
        : Math.min(30_000, 500 * 2 ** (attempt - 1));
      await sleep(delay);
      continue;
    }

    if (!response.ok) {
      const text = await response.text();
      if (/too_many_requests/i.test(text)) {
        attempt += 1;
        if (attempt > MAX_RETRIES) {
          throw new IndexRateLimitedError(
            `Dropbox too_many_requests after ${MAX_RETRIES} retries.`,
          );
        }
        await sleep(Math.min(30_000, 500 * 2 ** (attempt - 1)));
        continue;
      }
      throw new Error(`Dropbox API ${path} failed: ${text}`);
    }

    const data = (await response.json()) as {
      entries?: DropboxListEntry[];
      cursor: string;
      has_more: boolean;
    };
    return {
      entries: data.entries ?? [],
      cursor: data.cursor,
      hasMore: Boolean(data.has_more),
    };
  }
}
