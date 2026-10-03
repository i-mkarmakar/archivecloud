import "server-only";

import { google } from "googleapis";
import type { ConnectedAccount } from "@/generated/prisma/client";
import { getAuthedGoogleClient } from "@/server/modules/providers/google/google.service";

export type GoogleDriveListFile = {
  id?: string | null;
  name?: string | null;
  mimeType?: string | null;
  size?: string | null;
  parents?: string[] | null;
  shortcutDetails?: { targetId?: string | null } | null;
};

/**
 * Owned My Drive items only (`'me' in owners and trashed = false`).
 * corpora=user, spaces=drive — excludes Shared with me / shared drives.
 * @see https://developers.google.com/workspace/drive/api/guides/search-files
 */
export async function listOwnedGoogleDriveFilesPage(
  account: ConnectedAccount,
  params: { pageToken: string | null; pageSize: number },
): Promise<{ files: GoogleDriveListFile[]; nextPageToken: string | null }> {
  const auth = await getAuthedGoogleClient(account);
  const drive = google.drive({ version: "v3", auth });
  const response = await drive.files.list({
    q: "'me' in owners and trashed = false",
    corpora: "user",
    spaces: "drive",
    pageSize: params.pageSize,
    pageToken: params.pageToken ?? undefined,
    fields:
      "nextPageToken,files(id,name,mimeType,size,parents,shortcutDetails)",
  });
  return {
    files: response.data.files ?? [],
    nextPageToken: response.data.nextPageToken ?? null,
  };
}
