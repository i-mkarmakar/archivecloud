import "server-only";

import { prisma } from "@/server/config/prisma";
import {
  type CatalogIndexItem,
  IndexRateLimitedError,
  mapGoogleFileToCatalogItem,
} from "@/server/modules/indexing/catalog-upsert";
import type {
  CatalogChangeOp,
  ProviderIndexAdapter,
} from "@/server/modules/indexing/types";
import {
  type GoogleDriveChangeRow,
  getGoogleDriveChangesStartPageToken,
  isGoogleAuthError,
  isInvalidGoogleChangesTokenError,
  isInvalidGoogleListPageTokenError,
  listGoogleDriveChangesPage,
} from "@/server/modules/providers/google/google-drive-changes";
import { listOwnedGoogleDriveFilesPage } from "@/server/modules/providers/google/google-drive-list";
import { ensureGoogleDriveRootProviderId } from "@/server/modules/providers/google/google-drive-root";

const PAGE_SIZE = 200;
const MAX_RETRIES = 6;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /403|429|500|502|503|504|rate limit|userRateLimitExceeded|backendError/i.test(
    message,
  );
}

function isRateLimitExhaustedMessage(message: string): boolean {
  return /403|429|rate limit|userRateLimitExceeded/i.test(message);
}

async function withBackoff<T>(fn: () => Promise<T>): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (error) {
      attempt += 1;
      if (attempt > MAX_RETRIES || !isRetryableError(error)) {
        const message = error instanceof Error ? error.message : String(error);
        if (isRateLimitExhaustedMessage(message) && attempt > MAX_RETRIES) {
          throw new IndexRateLimitedError(
            `Google Drive rate limited after ${MAX_RETRIES} retries: ${message}`,
          );
        }
        throw error;
      }
      const delay = Math.min(30_000, 500 * 2 ** (attempt - 1));
      await sleep(delay);
    }
  }
}

function fileOwnedByMe(file: GoogleDriveChangeRow["file"]): boolean {
  if (!file?.owners?.length) return false;
  return file.owners.some((owner) => owner.me === true);
}

export function mapGoogleDriveChangeToOp(
  change: GoogleDriveChangeRow,
): CatalogChangeOp {
  if (change.removed) {
    return { type: "remove", providerFileId: change.fileId };
  }
  const file = change.file;
  if (!file || file.trashed) {
    return { type: "remove", providerFileId: change.fileId };
  }
  if (!fileOwnedByMe(file)) {
    return { type: "ignore" };
  }
  const item = mapGoogleFileToCatalogItem(file);
  if (!item) return { type: "ignore" };
  return { type: "upsert", item };
}

export function mapGoogleDriveFileToIndexItem(file: {
  id?: string | null;
  name?: string | null;
  mimeType?: string | null;
  size?: string | null;
  parents?: string[] | null;
  shortcutDetails?: { targetId?: string | null } | null;
}): CatalogIndexItem | null {
  return mapGoogleFileToCatalogItem(file);
}

export const googleDriveIndexAdapter: ProviderIndexAdapter = {
  provider: "google_drive",

  async getChangesStartToken(accountId) {
    const account = await prisma.connectedAccount.findUniqueOrThrow({
      where: { id: accountId },
    });
    return getGoogleDriveChangesStartPageToken(account);
  },

  ensureRootProviderId: ensureGoogleDriveRootProviderId,

  async listIndexPage(accountId, pageToken) {
    const account = await prisma.connectedAccount.findUniqueOrThrow({
      where: { id: accountId },
    });
    const response = await withBackoff(() =>
      listOwnedGoogleDriveFilesPage(account, {
        pageToken,
        pageSize: PAGE_SIZE,
      }),
    );
    const items: CatalogIndexItem[] = [];
    for (const file of response.files) {
      const mapped = mapGoogleDriveFileToIndexItem(file);
      if (mapped) items.push(mapped);
    }
    return {
      items,
      nextPageToken: response.nextPageToken,
    };
  },

  async listChangesPage(accountId, pageToken) {
    const account = await prisma.connectedAccount.findUniqueOrThrow({
      where: { id: accountId },
    });
    // Same backoff + IndexRateLimitedError path as full-scan list pages.
    const page = await withBackoff(() =>
      listGoogleDriveChangesPage(account, { pageToken }),
    );
    return {
      ops: page.changes.map(mapGoogleDriveChangeToOp),
      nextPageToken: page.nextPageToken,
      newStartPageToken: page.newStartPageToken,
    };
  },

  isInvalidListPageTokenError: isInvalidGoogleListPageTokenError,
  isInvalidChangesTokenError: isInvalidGoogleChangesTokenError,
  isAuthError: isGoogleAuthError,
  isRateLimitedError: (error) =>
    error instanceof IndexRateLimitedError ||
    /rate limited after/i.test(
      error instanceof Error ? error.message : String(error),
    ),
};
