/**
 * Top-level catalog membership: providerParentId equals the account root id.
 * Google/OneDrive store the real root id; Dropbox uses a synthetic root sentinel.
 * Use this (or `catalogRootParentWhere`) for any tree / path / "root contents" query.
 */
export function isTopLevelCatalogItem(
  item: { providerParentId: string | null | undefined },
  account: { indexRootProviderId: string | null | undefined },
): boolean {
  const rootId = account.indexRootProviderId;
  if (!rootId) {
    return item.providerParentId == null;
  }
  return item.providerParentId === rootId;
}

/** Prisma `where` fragment for catalog rows directly under the account root. */
export function catalogRootParentWhere(account: {
  indexRootProviderId: string | null | undefined;
}): { providerParentId: string | null } {
  return {
    providerParentId: account.indexRootProviderId ?? null,
  };
}

export const DROPBOX_ROOT_PROVIDER_ID = "dropbox:root";
