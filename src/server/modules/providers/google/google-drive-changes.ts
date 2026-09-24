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
