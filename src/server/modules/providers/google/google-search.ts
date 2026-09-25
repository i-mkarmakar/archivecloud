import "server-only";

import { google } from "googleapis";
import type { ConnectedAccount } from "@/generated/prisma/client";
import { getAuthedGoogleClient } from "@/server/modules/providers/google/google.service";

export type GoogleSearchHit = {
  id: string;
  name: string;
  kind: "file" | "folder";
  mimeType?: string;
  sizeBytes?: string;
  modifiedTime?: string;
  pathHint?: string;
};

function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export async function searchGoogleDrive(
  account: ConnectedAccount,
  query: string,
  limit: number,
): Promise<{ files: GoogleSearchHit[]; folders: GoogleSearchHit[] }> {
  const auth = await getAuthedGoogleClient(account);
  const drive = google.drive({ version: "v3", auth });
  const q = `trashed = false and name contains '${escapeDriveQueryValue(query)}'`;
  const response = await drive.files.list({
    q,
    spaces: "drive",
    fields: "files(id,name,mimeType,size,modifiedTime,quotaBytesUsed,parents)",
    pageSize: Math.min(limit, 100),
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    orderBy: "modifiedTime desc",
  });

  const files: GoogleSearchHit[] = [];
  const folders: GoogleSearchHit[] = [];
  for (const item of response.data.files ?? []) {
    if (!item.id || !item.name) continue;
    if (item.mimeType === "application/vnd.google-apps.folder") {
      folders.push({
        id: item.id,
        name: item.name,
        kind: "folder",
        modifiedTime: item.modifiedTime ?? undefined,
      });
    } else {
      files.push({
        id: item.id,
        name: item.name,
        kind: "file",
        mimeType: item.mimeType ?? "application/octet-stream",
        sizeBytes: String(item.size ?? item.quotaBytesUsed ?? 0),
        modifiedTime: item.modifiedTime ?? undefined,
      });
    }
  }
  return { files, folders };
}

export async function searchGoogleSharedDrive(
  account: ConnectedAccount,
  query: string,
  limit: number,
): Promise<{ files: GoogleSearchHit[]; folders: GoogleSearchHit[] }> {
  const auth = await getAuthedGoogleClient(account);
  const drive = google.drive({ version: "v3", auth });
  const driveId = account.providerAccountId;
  const q = `trashed = false and name contains '${escapeDriveQueryValue(query)}'`;
  const response = await drive.files.list({
    q,
    corpora: "drive",
    driveId,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    fields: "files(id,name,mimeType,size,modifiedTime,quotaBytesUsed)",
    pageSize: Math.min(limit, 100),
    orderBy: "modifiedTime desc",
  });

  const files: GoogleSearchHit[] = [];
  const folders: GoogleSearchHit[] = [];
  for (const item of response.data.files ?? []) {
    if (!item.id || !item.name) continue;
    if (item.mimeType === "application/vnd.google-apps.folder") {
      folders.push({
        id: item.id,
        name: item.name,
        kind: "folder",
        modifiedTime: item.modifiedTime ?? undefined,
      });
    } else {
      files.push({
        id: item.id,
        name: item.name,
        kind: "file",
        mimeType: item.mimeType ?? "application/octet-stream",
        sizeBytes: String(item.size ?? item.quotaBytesUsed ?? 0),
        modifiedTime: item.modifiedTime ?? undefined,
      });
    }
  }
  return { files, folders };
}
