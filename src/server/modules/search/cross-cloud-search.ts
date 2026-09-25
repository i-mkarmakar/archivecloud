import "server-only";

import type { ConnectedAccount } from "@/generated/prisma/client";
import { prisma } from "@/server/config/prisma";
import { getDropboxAccessToken } from "@/server/modules/dropbox/dropbox.service";
import { getOneDriveAccessToken } from "@/server/modules/onedrive/onedrive.service";
import {
  getPCloudAccessToken,
  getPCloudApiBaseForAccount,
} from "@/server/modules/pcloud/pcloud.service";
import {
  searchGoogleDrive,
  searchGoogleSharedDrive,
} from "@/server/modules/providers/google/google-search";
import { browseProviderFolder } from "@/server/modules/providers/operations";
import type {
  ProviderBrowseFile,
  ProviderBrowseFolder,
} from "@/server/modules/providers/types";

export type CloudSearchHit = {
  id: string;
  name: string;
  kind: "file" | "folder";
  mimeType?: string;
  sizeBytes?: string;
  modifiedTime?: string;
  pathHint?: string;
};

export type CloudSearchAccountResult = {
  accountId: string;
  provider: string;
  email: string;
  displayName: string | null;
  files: CloudSearchHit[];
  folders: CloudSearchHit[];
  error?: string;
};

function guessMimeFromName(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".zip")) return "application/zip";
  return "application/octet-stream";
}

async function searchDropbox(
  account: ConnectedAccount,
  query: string,
  limit: number,
): Promise<{ files: CloudSearchHit[]; folders: CloudSearchHit[] }> {
  const accessToken = await getDropboxAccessToken(account);
  const response = await fetch("https://api.dropboxapi.com/2/files/search_v2", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      options: {
        max_results: Math.min(limit, 100),
        file_status: "active",
        filename_only: true,
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`Dropbox search failed: ${await response.text()}`);
  }
  const data = (await response.json()) as {
    matches?: Array<{
      metadata?: {
        metadata?: {
          ".tag"?: string;
          name?: string;
          id?: string;
          path_display?: string;
          size?: number;
          server_modified?: string;
        };
      };
    }>;
  };

  const files: CloudSearchHit[] = [];
  const folders: CloudSearchHit[] = [];
  for (const match of data.matches ?? []) {
    const meta = match.metadata?.metadata;
    if (!meta?.name) continue;
    const id = meta.id || meta.path_display || meta.name;
    if (meta[".tag"] === "folder") {
      folders.push({
        id,
        name: meta.name,
        kind: "folder",
        pathHint: meta.path_display,
        modifiedTime: meta.server_modified,
      });
    } else if (meta[".tag"] === "file") {
      files.push({
        id,
        name: meta.name,
        kind: "file",
        mimeType: guessMimeFromName(meta.name),
        sizeBytes: String(meta.size ?? 0),
        pathHint: meta.path_display,
        modifiedTime: meta.server_modified,
      });
    }
  }
  return { files, folders };
}

async function searchOneDrive(
  account: ConnectedAccount,
  query: string,
  limit: number,
): Promise<{ files: CloudSearchHit[]; folders: CloudSearchHit[] }> {
  const accessToken = await getOneDriveAccessToken(account);
  const url = new URL(
    "https://graph.microsoft.com/v1.0/me/drive/root/search(q='" +
      query.replace(/'/g, "''") +
      "')",
  );
  url.searchParams.set("$top", String(Math.min(limit, 100)));
  url.searchParams.set(
    "$select",
    "id,name,size,lastModifiedDateTime,file,folder,parentReference",
  );
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`OneDrive search failed: ${await response.text()}`);
  }
  const data = (await response.json()) as {
    value?: Array<{
      id: string;
      name: string;
      size?: number;
      lastModifiedDateTime?: string;
      file?: { mimeType?: string };
      folder?: unknown;
      parentReference?: { path?: string };
    }>;
  };

  const files: CloudSearchHit[] = [];
  const folders: CloudSearchHit[] = [];
  for (const item of data.value ?? []) {
    if (item.folder) {
      folders.push({
        id: item.id,
        name: item.name,
        kind: "folder",
        pathHint: item.parentReference?.path,
        modifiedTime: item.lastModifiedDateTime,
      });
    } else {
      files.push({
        id: item.id,
        name: item.name,
        kind: "file",
        mimeType: item.file?.mimeType ?? guessMimeFromName(item.name),
        sizeBytes: String(item.size ?? 0),
        pathHint: item.parentReference?.path,
        modifiedTime: item.lastModifiedDateTime,
      });
    }
  }
  return { files, folders };
}

async function searchPCloud(
  account: ConnectedAccount,
  query: string,
  limit: number,
): Promise<{ files: CloudSearchHit[]; folders: CloudSearchHit[] }> {
  const accessToken = await getPCloudAccessToken(account);
  const apiBase = getPCloudApiBaseForAccount(account);
  const url = new URL(`${apiBase}/listfolder`);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("folderid", "0");
  url.searchParams.set("recursive", "1");
  const response = await fetch(url);
  const data = (await response.json()) as {
    result: number;
    error?: string;
    metadata?: {
      contents?: Array<{
        fileid?: number;
        folderid?: number;
        name: string;
        isfolder?: boolean;
        size?: number;
        contenttype?: string;
        modified?: number;
        path?: string;
      }>;
    };
  };
  if (!response.ok || data.result !== 0) {
    throw new Error(data.error ?? "pCloud search failed");
  }

  const q = query.toLowerCase();
  const files: CloudSearchHit[] = [];
  const folders: CloudSearchHit[] = [];
  const walk = (
    entries: NonNullable<NonNullable<typeof data.metadata>["contents"]>,
  ) => {
    for (const entry of entries) {
      const nested = (entry as { contents?: typeof entries }).contents;
      if (nested?.length) walk(nested);
      if (!entry.name.toLowerCase().includes(q)) continue;
      if (entry.isfolder) {
        if (folders.length < limit) {
          folders.push({
            id: String(entry.folderid),
            name: entry.name,
            kind: "folder",
            pathHint: entry.path,
            modifiedTime: entry.modified
              ? new Date(entry.modified * 1000).toISOString()
              : undefined,
          });
        }
      } else if (files.length < limit) {
        files.push({
          id: String(entry.fileid),
          name: entry.name,
          kind: "file",
          mimeType: entry.contenttype ?? guessMimeFromName(entry.name),
          sizeBytes: String(entry.size ?? 0),
          pathHint: entry.path,
          modifiedTime: entry.modified
            ? new Date(entry.modified * 1000).toISOString()
            : undefined,
        });
      }
    }
  };
  walk(data.metadata?.contents ?? []);
  return { files, folders };
}

async function searchViaBrowse(
  account: ConnectedAccount,
  userId: string,
  query: string,
): Promise<{ files: CloudSearchHit[]; folders: CloudSearchHit[] }> {
  const result = await browseProviderFolder(account, userId, "root", query);
  return {
    files: result.files.map((file: ProviderBrowseFile) => ({
      id: file.id,
      name: file.name,
      kind: "file" as const,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      modifiedTime: file.modifiedTime,
    })),
    folders: result.folders.map((folder: ProviderBrowseFolder) => ({
      id: folder.id,
      name: folder.name,
      kind: "folder" as const,
      modifiedTime: folder.modifiedTime,
    })),
  };
}

export async function searchConnectedAccount(
  account: ConnectedAccount,
  userId: string,
  query: string,
  limit: number,
): Promise<CloudSearchAccountResult> {
  const base = {
    accountId: account.id,
    provider: account.provider,
    email: account.email,
    displayName: account.displayName,
  };

  try {
    let hits: { files: CloudSearchHit[]; folders: CloudSearchHit[] };
    switch (account.provider) {
      case "google_drive":
        hits = await searchGoogleDrive(account, query, limit);
        break;
      case "google_shared_drive":
        hits = await searchGoogleSharedDrive(account, query, limit);
        break;
      case "dropbox":
        hits = await searchDropbox(account, query, limit);
        break;
      case "onedrive":
        hits = await searchOneDrive(account, query, limit);
        break;
      case "pcloud":
        hits = await searchPCloud(account, query, limit);
        break;
      case "icloud_drive":
      case "icloud_photos":
        hits = { files: [], folders: [] };
        break;
      default:
        hits = await searchViaBrowse(account, userId, query);
        break;
    }

    return {
      ...base,
      files: hits.files.slice(0, limit),
      folders: hits.folders.slice(0, limit),
    };
  } catch (error) {
    return {
      ...base,
      files: [],
      folders: [],
      error: error instanceof Error ? error.message : "Search failed",
    };
  }
}

export async function searchAllConnectedAccounts(params: {
  userId: string;
  query: string;
  accountId?: string;
  limitPerAccount?: number;
}): Promise<CloudSearchAccountResult[]> {
  const limit = params.limitPerAccount ?? 25;
  const accounts = await prisma.connectedAccount.findMany({
    where: {
      userId: params.userId,
      status: "connected",
      ...(params.accountId ? { id: params.accountId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  const results = await Promise.all(
    accounts.map((account) =>
      searchConnectedAccount(account, params.userId, params.query, limit),
    ),
  );
  return results;
}
