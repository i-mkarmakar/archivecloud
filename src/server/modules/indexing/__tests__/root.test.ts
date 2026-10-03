import { describe, expect, it } from "vitest";
import {
  catalogRootParentWhere,
  DROPBOX_ROOT_PROVIDER_ID,
  isTopLevelCatalogItem,
} from "@/server/modules/indexing/root";

describe("isTopLevelCatalogItem", () => {
  it("matches providerParentId to the stored root id", () => {
    expect(
      isTopLevelCatalogItem(
        { providerParentId: "root-abc" },
        { indexRootProviderId: "root-abc" },
      ),
    ).toBe(true);
    expect(
      isTopLevelCatalogItem(
        { providerParentId: "other" },
        { indexRootProviderId: "root-abc" },
      ),
    ).toBe(false);
  });

  it("falls back to null parent when root id is not stored yet", () => {
    expect(
      isTopLevelCatalogItem(
        { providerParentId: null },
        { indexRootProviderId: null },
      ),
    ).toBe(true);
    expect(
      isTopLevelCatalogItem(
        { providerParentId: "x" },
        { indexRootProviderId: null },
      ),
    ).toBe(false);
  });

  it("treats Dropbox synthetic root as top-level parent", () => {
    expect(
      isTopLevelCatalogItem(
        { providerParentId: DROPBOX_ROOT_PROVIDER_ID },
        { indexRootProviderId: DROPBOX_ROOT_PROVIDER_ID },
      ),
    ).toBe(true);
    expect(
      catalogRootParentWhere({
        indexRootProviderId: DROPBOX_ROOT_PROVIDER_ID,
      }),
    ).toEqual({ providerParentId: DROPBOX_ROOT_PROVIDER_ID });
  });
});
