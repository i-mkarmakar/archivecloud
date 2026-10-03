import { describe, expect, it } from "vitest";
import {
  accountNeedsReconnect,
  DROPBOX_OAUTH_SCOPES,
  GOOGLE_DRIVE_OAUTH_SCOPES,
  hasRequiredScopes,
} from "@/server/modules/providers/scopes";

describe("accountNeedsReconnect", () => {
  it("flags missing OAuth scopes", () => {
    const result = accountNeedsReconnect(
      {
        provider: "google_drive",
        scopes: ["https://www.googleapis.com/auth/userinfo.email"],
      },
      { wholeAccountIndexingEnabled: false },
    );
    expect(result).toEqual({ needsReconnect: true, reason: "scopes" });
    expect(hasRequiredScopes("google_drive", GOOGLE_DRIVE_OAUTH_SCOPES)).toBe(
      true,
    );
  });

  it("does not flag existing Google accounts with realistic stored scopes", () => {
    // Typical ConnectedAccount.scopes: required Drive scopes + openid, shuffled.
    const stored = [
      "openid",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/userinfo.email",
    ];
    expect(
      accountNeedsReconnect(
        { provider: "google_drive", scopes: stored },
        { wholeAccountIndexingEnabled: true },
      ),
    ).toEqual({ needsReconnect: false, reason: null });

    // Same scopes as required list, different order only.
    expect(
      accountNeedsReconnect(
        {
          provider: "google_drive",
          scopes: [...GOOGLE_DRIVE_OAUTH_SCOPES].reverse(),
        },
        { wholeAccountIndexingEnabled: false },
      ),
    ).toEqual({ needsReconnect: false, reason: null });
  });

  it("flags Dropbox full-access only when indexing is enabled", () => {
    const account = {
      provider: "dropbox",
      scopes: [...DROPBOX_OAUTH_SCOPES],
      dropboxNeedsFullAccess: true,
    };
    expect(
      accountNeedsReconnect(account, { wholeAccountIndexingEnabled: false }),
    ).toEqual({ needsReconnect: false, reason: null });
    expect(
      accountNeedsReconnect(account, { wholeAccountIndexingEnabled: true }),
    ).toEqual({ needsReconnect: true, reason: "dropbox_full_access" });
  });
});
