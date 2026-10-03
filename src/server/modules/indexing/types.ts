import type { CatalogIndexItem } from "@/server/modules/indexing/catalog-upsert";

export type IndexPage = {
  items: CatalogIndexItem[];
  /** Soft-remove these provider file ids (e.g. OneDrive deleted facet on enum). */
  removedProviderFileIds?: string[];
  /** Soft-remove exact providerPathLower only (Dropbox file delete). */
  removedPaths?: string[];
  /** Soft-remove by path prefix (Dropbox folder DeletedMetadata — path, not id). */
  removedPathPrefixes?: string[];
  nextPageToken: string | null;
  /**
   * Terminal-page cursor for providers that only learn the changes token at
   * the end of a full enumeration (OneDrive deltaLink, Dropbox cursor).
   */
  finalChangesCursor?: string | null;
};

export type CatalogChangeOp =
  | { type: "upsert"; item: CatalogIndexItem }
  | { type: "remove"; providerFileId: string }
  | { type: "remove_path"; pathLower: string }
  | { type: "remove_path_prefix"; pathLower: string }
  | { type: "ignore" };

export type ChangesPage = {
  ops: CatalogChangeOp[];
  nextPageToken: string | null;
  newStartPageToken: string | null;
};

export type IndexAccountStatus = {
  indexStatus: string;
  indexFilesIndexed: number;
  indexLastError: string | null;
  indexStartedAt: string | null;
  indexFinishedAt: string | null;
  indexPageToken: string | null;
  indexScanId: string | null;
  indexNeedsFullScan: boolean;
  indexFullScanAttempts: number;
  indexHeartbeatAt: string | null;
};

/**
 * Provider-specific surface. Lock/heartbeat/reconcile/scheduling stay in the engine.
 */
export type ProviderIndexAdapter = {
  provider: string;
  /**
   * Pre-scan changes cursor. Return a string to store before the first list
   * page (Google). Return null to defer until `IndexPage.finalChangesCursor`
   * on the terminal page (OneDrive/Dropbox).
   */
  getChangesStartToken: (accountId: string) => Promise<string | null>;
  /** Resolve and persist the account's provider root id (idempotent). */
  ensureRootProviderId: (accountId: string) => Promise<string>;
  listIndexPage: (
    accountId: string,
    pageToken: string | null,
  ) => Promise<IndexPage>;
  listChangesPage: (
    accountId: string,
    pageToken: string,
  ) => Promise<ChangesPage>;
  isInvalidListPageTokenError: (error: unknown) => boolean;
  isInvalidChangesTokenError: (error: unknown) => boolean;
  isAuthError: (error: unknown) => boolean;
  /** True when retries exhausted due to rate limits — engine pauses (resumable). */
  isRateLimitedError?: (error: unknown) => boolean;
};
