import "server-only";

import type { ConnectedAccount } from "@/generated/prisma/client";
import { getDropboxAccessToken } from "@/server/modules/dropbox/dropbox.service";

const DROPBOX_API = "https://api.dropboxapi.com/2";

export class DropboxTeamAccountError extends Error {
  constructor(
    message = "DROPBOX_TEAM: Team/Business Dropbox accounts are not supported for whole-account indexing.",
  ) {
    super(message);
    this.name = "DropboxTeamAccountError";
  }
}

type DropboxCurrentAccount = {
  account_id?: string;
  account_type?: { ".tag"?: string };
  root_info?: { ".tag"?: string };
};

/**
 * Personal accounts only. Team root vs member-home (Dropbox-API-Path-Root)
 * is not implemented — refuse Business/team tokens up front.
 */
export async function assertDropboxPersonalAccount(
  account: ConnectedAccount,
): Promise<void> {
  const accessToken = await getDropboxAccessToken(account);
  const response = await fetch(`${DROPBOX_API}/users/get_current_account`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: "null",
  });
  if (!response.ok) {
    throw new Error(
      `Dropbox get_current_account failed: ${await response.text()}`,
    );
  }
  const data = (await response.json()) as DropboxCurrentAccount;
  const rootTag = data.root_info?.[".tag"]?.toLowerCase();
  const accountType = data.account_type?.[".tag"]?.toLowerCase();
  if (rootTag === "team" || accountType === "business") {
    throw new DropboxTeamAccountError();
  }
}

export function isDropboxTeamAccountError(error: unknown): boolean {
  return (
    error instanceof DropboxTeamAccountError ||
    (error instanceof Error && error.message.startsWith("DROPBOX_TEAM"))
  );
}
