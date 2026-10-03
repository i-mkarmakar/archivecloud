import "server-only";

import { google } from "googleapis";
import type { ConnectedAccount } from "@/generated/prisma/client";
import { getAuthedGoogleClient } from "@/server/modules/providers/google/google.service";

export async function getGoogleDriveChangesStartPageToken(
  account: ConnectedAccount,
): Promise<string> {
  const auth = await getAuthedGoogleClient(account);
  const drive = google.drive({ version: "v3", auth });
  const startPage = await drive.changes.getStartPageToken({
    supportsAllDrives: true,
  });
  const pageToken = startPage.data.startPageToken;
  if (!pageToken) {
    throw new Error("Google Drive did not return a start page token.");
  }
  return pageToken;
}

export async function watchGoogleDriveChanges(
  account: ConnectedAccount,
  params: {
    pageToken: string;
    channelId: string;
    channelToken: string;
    address: string;
    expirationMs: number;
  },
): Promise<{ resourceId: string | null; expirationAt: Date }> {
  const auth = await getAuthedGoogleClient(account);
  const drive = google.drive({ version: "v3", auth });
  const watch = await drive.changes.watch({
    pageToken: params.pageToken,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    requestBody: {
      id: params.channelId,
      type: "web_hook",
      address: params.address,
      token: params.channelToken,
      expiration: String(params.expirationMs),
    },
  });

  return {
    resourceId: watch.data.resourceId ?? null,
    expirationAt: watch.data.expiration
      ? new Date(Number(watch.data.expiration))
      : new Date(params.expirationMs),
  };
}

export async function stopGoogleDriveChannel(
  account: ConnectedAccount,
  params: { channelId: string; resourceId: string },
): Promise<void> {
  const auth = await getAuthedGoogleClient(account);
  const drive = google.drive({ version: "v3", auth });
  await drive.channels.stop({
    requestBody: {
      id: params.channelId,
      resourceId: params.resourceId,
    },
  });
}

export type GoogleDriveChangeRow = {
  fileId: string;
  removed: boolean;
  file?: {
    id?: string | null;
    name?: string | null;
    mimeType?: string | null;
    size?: string | null;
    parents?: string[] | null;
    trashed?: boolean | null;
    owners?: Array<{
      me?: boolean | null;
      emailAddress?: string | null;
    }> | null;
    shortcutDetails?: {
      targetId?: string | null;
      targetMimeType?: string | null;
    } | null;
  } | null;
};

/**
 * Incremental change page. restrictToMyDrive matches full-scan ownership intent.
 * @see https://developers.google.com/workspace/drive/api/guides/manage-changes
 */
export async function listGoogleDriveChangesPage(
  account: ConnectedAccount,
  params: { pageToken: string; pageSize?: number },
): Promise<{
  changes: GoogleDriveChangeRow[];
  nextPageToken: string | null;
  newStartPageToken: string | null;
}> {
  const auth = await getAuthedGoogleClient(account);
  const drive = google.drive({ version: "v3", auth });
  const response = await drive.changes.list({
    pageToken: params.pageToken,
    pageSize: params.pageSize ?? 200,
    includeRemoved: true,
    restrictToMyDrive: true,
    spaces: "drive",
    fields:
      "nextPageToken,newStartPageToken,changes(fileId,removed,changeType,file(id,name,mimeType,size,parents,trashed,owners(me,emailAddress),shortcutDetails(targetId,targetMimeType)))",
  });

  const changes: GoogleDriveChangeRow[] = [];
  for (const change of response.data.changes ?? []) {
    if (!change.fileId) continue;
    if (change.changeType && change.changeType !== "file") continue;
    changes.push({
      fileId: change.fileId,
      removed: Boolean(change.removed),
      file: change.file
        ? {
            id: change.file.id,
            name: change.file.name,
            mimeType: change.file.mimeType,
            size: change.file.size ?? undefined,
            parents: change.file.parents,
            trashed: change.file.trashed,
            owners: change.file.owners,
            shortcutDetails: change.file.shortcutDetails,
          }
        : null,
    });
  }

  return {
    changes,
    nextPageToken: response.data.nextPageToken ?? null,
    newStartPageToken: response.data.newStartPageToken ?? null,
  };
}

export function isInvalidGoogleChangesTokenError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /invalid.*(pageToken|token)|pageToken.*invalid|410|expired/i.test(
    message,
  );
}

/**
 * files.list pageToken expired/invalid (resume must restart cleanly).
 * Prefer Google's invalidPageToken / pageToken wording; keep Invalid Value as fallback.
 */
export function isInvalidGoogleListPageTokenError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /invalidPageToken|invalid.*(pageToken|page token)|pageToken.*invalid|(Invalid Value.*pageToken)|(pageToken.*Invalid Value)/i.test(
    message,
  );
}

export function isGoogleAuthError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /tokens are missing|invalid_grant|invalid_rapt|unauthorized|auth(?:entication|orization).*fail|refresh.*token|Token has been expired or revoked/i.test(
    message,
  );
}
