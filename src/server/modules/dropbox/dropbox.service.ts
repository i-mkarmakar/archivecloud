import "server-only";

import { Readable } from "node:stream";
import type {
  ConnectedAccount,
  ProviderConfig,
} from "@/generated/prisma/client";
import { env } from "@/server/config/env";
import { prisma } from "@/server/config/prisma";
import type { ProviderBrowseResult } from "@/server/modules/providers/types";
import { decryptText, encryptText } from "@/server/utils/crypto";

export const dropboxOAuthScopes = [
  "account_info.read",
  "files.metadata.read",
  "files.content.read",
  "files.content.write",
];

const APP_FOLDER = "/archivecloud";
const DROPBOX_AUTH_URL = "https://www.dropbox.com/oauth2/authorize";
const DROPBOX_TOKEN_URL = "https://api.dropboxapi.com/oauth2/token";
const DROPBOX_API = "https://api.dropboxapi.com/2";
const DROPBOX_CONTENT = "https://content.dropboxapi.com/2";

function isConfiguredEnvValue(
  value: string | undefined,
  placeholders: string[],
) {
  if (!value?.trim()) return false;
  return !placeholders.includes(value.trim());
}

export async function ensureGlobalDropboxProviderConfig(): Promise<ProviderConfig | null> {
  const clientId = env.DROPBOX_CLIENT_ID?.trim();
  const clientSecret = env.DROPBOX_CLIENT_SECRET?.trim();
  const redirectUri = env.DROPBOX_REDIRECT_URI;

  const hasClientId = isConfiguredEnvValue(clientId, [
    "your-dropbox-client-id",
    "your-client-id",
    "build-dropbox-client-id",
  ]);
  const hasClientSecret = isConfiguredEnvValue(clientSecret, [
    "your-dropbox-client-secret",
    "your-client-secret",
    "build-dropbox-client-secret",
  ]);
  if (!hasClientId || !hasClientSecret) return null;

  const existing = await prisma.providerConfig.findFirst({
    where: { userId: null, provider: "dropbox", status: "active" },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    const sameId = decryptText(existing.clientIdEncrypted) === clientId;
    const sameSecret =
      decryptText(existing.clientSecretEncrypted) === clientSecret;
    const sameRedirect = existing.redirectUri === redirectUri;
    const sameScopes =
      JSON.stringify(existing.scopes) === JSON.stringify(dropboxOAuthScopes);
    if (sameId && sameSecret && sameRedirect && sameScopes) return existing;

    await prisma.providerConfig.update({
      where: { id: existing.id },
      data: {
        clientIdEncrypted: encryptText(clientId!),
        clientSecretEncrypted: encryptText(clientSecret!),
        redirectUri,
        scopes: dropboxOAuthScopes,
        status: "active",
      },
    });
    return prisma.providerConfig.findUniqueOrThrow({
      where: { id: existing.id },
    });
  }

  await prisma.providerConfig.updateMany({
    where: { userId: null, provider: "dropbox", status: "active" },
    data: { status: "disabled" },
  });

  return prisma.providerConfig.create({
    data: {
      userId: null,
      provider: "dropbox",
      clientIdEncrypted: encryptText(clientId!),
      clientSecretEncrypted: encryptText(clientSecret!),
      redirectUri,
      scopes: dropboxOAuthScopes,
      status: "active",
    },
  });
}

export function buildDropboxAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes: string[];
}) {
  const url = new URL(DROPBOX_AUTH_URL);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", params.state);
  url.searchParams.set("token_access_type", "offline");
  url.searchParams.set("scope", params.scopes.join(" "));
  return url.toString();
}

type DropboxTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  account_id?: string;
  uid?: string;
  scope?: string;
};

export async function exchangeDropboxCode(params: {
  config: ProviderConfig;
  code: string;
}): Promise<DropboxTokenResponse> {
  const body = new URLSearchParams({
    code: params.code,
    grant_type: "authorization_code",
    redirect_uri: params.config.redirectUri,
    client_id: decryptText(params.config.clientIdEncrypted),
    client_secret: decryptText(params.config.clientSecretEncrypted),
  });
  const response = await fetch(DROPBOX_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Dropbox token exchange failed: ${text}`);
  }
  return (await response.json()) as DropboxTokenResponse;
}

async function refreshDropboxAccessToken(account: ConnectedAccount) {
  if (!account.refreshTokenEncrypted || !account.providerConfigId) {
    throw new Error("Dropbox refresh token or provider config missing.");
  }
  const config = await prisma.providerConfig.findUniqueOrThrow({
    where: { id: account.providerConfigId },
  });
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: decryptText(account.refreshTokenEncrypted),
    client_id: decryptText(config.clientIdEncrypted),
    client_secret: decryptText(config.clientSecretEncrypted),
  });
  const response = await fetch(DROPBOX_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Dropbox token refresh failed: ${text}`);
  }
  const tokens = (await response.json()) as DropboxTokenResponse;
  if (!tokens.access_token) {
    throw new Error("Dropbox refresh did not return access_token.");
  }
  const tokenExpiresAt = new Date(
    Date.now() + (tokens.expires_in ?? 14400) * 1000,
  );
  await prisma.connectedAccount.update({
    where: { id: account.id },
    data: {
      accessTokenEncrypted: encryptText(tokens.access_token),
      tokenExpiresAt,
      ...(tokens.refresh_token
        ? { refreshTokenEncrypted: encryptText(tokens.refresh_token) }
        : {}),
    },
  });
  return tokens.access_token;
}

export async function getDropboxAccessToken(account: ConnectedAccount) {
  if (!account.accessTokenEncrypted) {
    throw new Error("Dropbox access token missing.");
  }
  const expiresSoon =
    !account.tokenExpiresAt ||
    account.tokenExpiresAt.getTime() < Date.now() + 60_000;
  if (expiresSoon && account.refreshTokenEncrypted) {
    return refreshDropboxAccessToken(account);
  }
  return decryptText(account.accessTokenEncrypted);
}

async function dropboxApi<T>(
  account: ConnectedAccount,
  path: string,
  body?: unknown,
): Promise<T> {
  const accessToken = await getDropboxAccessToken(account);
  const hasBody = body !== undefined;
  const response = await fetch(`${DROPBOX_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: hasBody ? JSON.stringify(body) : "null",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Dropbox API ${path} failed: ${text}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function getDropboxAccountProfile(account: ConnectedAccount) {
  return dropboxApi<{
    account_id: string;
    name: { display_name?: string };
    email: string;
    profile_photo_url?: string;
  }>(account, "/users/get_current_account");
}

export async function getDropboxAccountProfileWithToken(accessToken: string) {
  // Dropbox RPC endpoints with no args expect JSON body `null`.
  // https://docs.dropboxapi.com/dropbox-api/api-reference/user-endpoints/users/get-current-account
  const response = await fetch(`${DROPBOX_API}/users/get_current_account`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: "null",
  });
  if (!response.ok) {
    throw new Error(`Dropbox profile fetch failed: ${await response.text()}`);
  }
  return (await response.json()) as {
    account_id: string;
    name: { display_name?: string };
    email: string;
    profile_photo_url?: string;
  };
}

export async function syncDropboxQuota(accountId: string) {
  const account = await prisma.connectedAccount.findUniqueOrThrow({
    where: { id: accountId },
  });
  const usage = await dropboxApi<{
    used: number;
    allocation: { ".tag": string; allocated?: number };
  }>(account, "/users/get_space_usage");

  const used = BigInt(usage.used ?? 0);
  const total =
    usage.allocation?.allocated != null
      ? BigInt(usage.allocation.allocated)
      : null;

  return prisma.storageAccount.upsert({
    where: { connectedAccountId: accountId },
    create: {
      connectedAccountId: accountId,
      totalBytes: total,
      usedBytes: used,
      availableBytes: total === null ? null : total - used,
      lastSyncedAt: new Date(),
    },
    update: {
      totalBytes: total,
      usedBytes: used,
      availableBytes: total === null ? null : total - used,
      lastSyncedAt: new Date(),
    },
  });
}

function toDropboxPath(parentId: string) {
  if (!parentId || parentId === "root") return "";
  return parentId;
}

function guessMimeType(fileName: string) {
  const lower = fileName.toLowerCase();
  if (/\.(jpe?g)$/.test(lower)) return "image/jpeg";
  if (/\.png$/.test(lower)) return "image/png";
  if (/\.gif$/.test(lower)) return "image/gif";
  if (/\.webp$/.test(lower)) return "image/webp";
  if (/\.pdf$/.test(lower)) return "application/pdf";
  if (/\.mp4$/.test(lower)) return "video/mp4";
  if (/\.mov$/.test(lower)) return "video/quicktime";
  if (/\.txt$/.test(lower)) return "text/plain";
  if (/\.json$/.test(lower)) return "application/json";
  if (/\.zip$/.test(lower)) return "application/zip";
  return "application/octet-stream";
}

type DropboxListEntry = {
  ".tag": "file" | "folder" | "deleted";
  name: string;
  path_display?: string;
  path_lower?: string;
  id?: string;
  size?: number;
  server_modified?: string;
  client_modified?: string;
};

export async function browseDropboxFolder(
  accountId: string,
  userId: string,
  parentId: string,
  searchQuery?: string,
  options?: { limit?: number },
): Promise<ProviderBrowseResult> {
  const account = await prisma.connectedAccount.findFirstOrThrow({
    where: {
      id: accountId,
      userId,
      provider: "dropbox",
      status: "connected",
    },
  });

  const path = toDropboxPath(parentId);
  const maxItems = options?.limit;
  const listed = await dropboxApi<{
    entries: DropboxListEntry[];
    cursor: string;
    has_more: boolean;
  }>(account, "/files/list_folder", {
    path,
    recursive: false,
    include_deleted: false,
    include_mounted_folders: true,
    limit: maxItems ? Math.min(maxItems, 500) : 2000,
  });

  let entries = listed.entries ?? [];
  let cursor = listed.cursor;
  let hasMore = listed.has_more;
  while (hasMore && !maxItems) {
    const more = await dropboxApi<{
      entries: DropboxListEntry[];
      cursor: string;
      has_more: boolean;
    }>(account, "/files/list_folder/continue", { cursor });
    entries = entries.concat(more.entries ?? []);
    cursor = more.cursor;
    hasMore = more.has_more;
  }

  const q = searchQuery?.trim().toLowerCase();
  if (q) {
    entries = entries.filter((entry) => entry.name.toLowerCase().includes(q));
  }

  const folders = entries
    .filter((entry) => entry[".tag"] === "folder")
    .map((entry) => ({
      id: entry.path_display || entry.path_lower || entry.id || entry.name,
      name: entry.name,
      modifiedTime:
        entry.server_modified ??
        entry.client_modified ??
        new Date().toISOString(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const files = entries
    .filter((entry) => entry[".tag"] === "file")
    .map((entry) => ({
      id: entry.id || entry.path_display || entry.name,
      name: entry.name,
      mimeType: guessMimeType(entry.name),
      sizeBytes: String(entry.size ?? 0),
      modifiedTime:
        entry.server_modified ??
        entry.client_modified ??
        new Date().toISOString(),
      hasThumbnail: false as boolean,
      dbFileId: null as string | null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const providerFileIds = files.map((file) => file.id);
  if (providerFileIds.length > 0) {
    const tracked = await prisma.file.findMany({
      where: {
        userId,
        connectedAccountId: accountId,
        providerFileId: { in: providerFileIds },
        status: "active",
        deletedAt: null,
      },
      select: { id: true, providerFileId: true },
    });
    const dbByProviderId = new Map(
      tracked.map((file) => [file.providerFileId, file.id]),
    );
    for (const file of files) {
      file.dbFileId = dbByProviderId.get(file.id) ?? null;
    }
  }

  const breadcrumbs: Array<{ id: string; name: string }> = [
    { id: "root", name: "Dropbox" },
  ];
  if (path) {
    const parts = path.split("/").filter(Boolean);
    let current = "";
    for (const part of parts) {
      current += `/${part}`;
      breadcrumbs.push({ id: current, name: part });
    }
  }

  return { folders, files, breadcrumbs };
}

export async function ensureDropboxAppFolder(account: ConnectedAccount) {
  try {
    await dropboxApi(account, "/files/get_metadata", { path: APP_FOLDER });
  } catch {
    await dropboxApi(account, "/files/create_folder_v2", {
      path: APP_FOLDER,
      autorename: false,
    });
  }
  return APP_FOLDER;
}

export async function getDropboxFileMetadata(
  account: ConnectedAccount,
  pathOrId: string,
) {
  return dropboxApi<{
    ".tag": string;
    name: string;
    id: string;
    path_display?: string;
    size?: number;
    server_modified?: string;
  }>(account, "/files/get_metadata", {
    path: pathOrId,
  });
}

export async function downloadDropboxFileStream(
  account: ConnectedAccount,
  pathOrId: string,
) {
  const accessToken = await getDropboxAccessToken(account);
  const response = await fetch(`${DROPBOX_CONTENT}/files/download`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Dropbox-API-Arg": JSON.stringify({ path: pathOrId }),
    },
  });
  if (!response.ok || !response.body) {
    const text = await response.text();
    throw new Error(`Dropbox download failed: ${text}`);
  }
  return Readable.fromWeb(response.body as import("stream/web").ReadableStream);
}

function toBody(chunk: Buffer): BodyInit {
  return new Blob([new Uint8Array(chunk)]);
}

export async function uploadDropboxFileFromStream(params: {
  account: ConnectedAccount;
  destPath: string;
  body: Readable;
  sizeBytes?: bigint;
}) {
  const accessToken = await getDropboxAccessToken(params.account);
  const CHUNK = 8 * 1024 * 1024;
  const sizeKnown =
    params.sizeBytes !== undefined &&
    params.sizeBytes <= BigInt(150 * 1024 * 1024);

  if (sizeKnown) {
    const chunks: Buffer[] = [];
    for await (const chunk of params.body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);
    const response = await fetch(`${DROPBOX_CONTENT}/files/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({
          path: params.destPath,
          mode: "add",
          autorename: true,
          mute: false,
        }),
      },
      body: toBody(buffer),
    });
    if (!response.ok) {
      throw new Error(`Dropbox upload failed: ${await response.text()}`);
    }
    return (await response.json()) as {
      id: string;
      name: string;
      size: number;
      path_display?: string;
    };
  }

  let sessionId: string | null = null;
  let offset = 0;
  let buffer = Buffer.alloc(0);

  async function flush(chunk: Buffer, finish: boolean) {
    if (!sessionId) {
      if (finish) {
        const response = await fetch(`${DROPBOX_CONTENT}/files/upload`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/octet-stream",
            "Dropbox-API-Arg": JSON.stringify({
              path: params.destPath,
              mode: "add",
              autorename: true,
              mute: false,
            }),
          },
          body: toBody(chunk),
        });
        if (!response.ok) {
          throw new Error(`Dropbox upload failed: ${await response.text()}`);
        }
        return (await response.json()) as {
          id: string;
          name: string;
          size: number;
          path_display?: string;
        };
      }

      const start = await fetch(
        `${DROPBOX_CONTENT}/files/upload_session/start`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/octet-stream",
            "Dropbox-API-Arg": JSON.stringify({ close: false }),
          },
          body: toBody(chunk),
        },
      );
      if (!start.ok) {
        throw new Error(
          `Dropbox upload session start failed: ${await start.text()}`,
        );
      }
      const started = (await start.json()) as { session_id: string };
      sessionId = started.session_id;
      offset += chunk.length;
      return;
    }

    if (finish) {
      const finishRes = await fetch(
        `${DROPBOX_CONTENT}/files/upload_session/finish`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/octet-stream",
            "Dropbox-API-Arg": JSON.stringify({
              cursor: { session_id: sessionId, offset },
              commit: {
                path: params.destPath,
                mode: "add",
                autorename: true,
                mute: false,
              },
            }),
          },
          body: toBody(chunk),
        },
      );
      if (!finishRes.ok) {
        throw new Error(
          `Dropbox upload session finish failed: ${await finishRes.text()}`,
        );
      }
      return (await finishRes.json()) as {
        id: string;
        name: string;
        size: number;
        path_display?: string;
      };
    }

    const appendRes = await fetch(
      `${DROPBOX_CONTENT}/files/upload_session/append_v2`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/octet-stream",
          "Dropbox-API-Arg": JSON.stringify({
            cursor: { session_id: sessionId, offset },
            close: false,
          }),
        },
        body: toBody(chunk),
      },
    );
    if (!appendRes.ok) {
      throw new Error(
        `Dropbox upload session append failed: ${await appendRes.text()}`,
      );
    }
    offset += chunk.length;
  }

  for await (const piece of params.body) {
    const next = Buffer.isBuffer(piece) ? piece : Buffer.from(piece);
    buffer = Buffer.concat([buffer, next]);
    while (buffer.length >= CHUNK) {
      const chunk = buffer.subarray(0, CHUNK);
      buffer = buffer.subarray(CHUNK);
      await flush(chunk, false);
    }
  }

  const finished = await flush(buffer, true);
  if (!finished) {
    throw new Error("Dropbox upload session did not return file metadata.");
  }
  return finished;
}

export async function deleteDropboxFile(
  account: ConnectedAccount,
  pathOrId: string,
) {
  await dropboxApi(account, "/files/delete_v2", { path: pathOrId });
}

export function joinDropboxPath(parentPath: string, fileName: string) {
  const safeName = fileName.replaceAll("/", "_");
  if (!parentPath || parentPath === "root") return `/${safeName}`;
  return `${parentPath.replace(/\/$/, "")}/${safeName}`;
}

export { guessMimeType as guessDropboxMimeType };
