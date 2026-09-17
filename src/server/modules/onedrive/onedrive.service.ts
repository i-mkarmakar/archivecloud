import type {
  ConnectedAccount,
  ProviderConfig,
} from "@/generated/prisma/client";
import { Readable } from "node:stream";
import { env } from "@/server/config/env";
import { prisma } from "@/server/config/prisma";
import type { ProviderBrowseResult } from "@/server/modules/providers/types";
import { decryptText, encryptText } from "@/server/utils/crypto";

export const onedriveOAuthScopes = [
  "offline_access",
  "User.Read",
  "Files.ReadWrite.All",
];

const APP_FOLDER_NAME = "archivecloud";
const AUTH_URL =
  "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH = "https://graph.microsoft.com/v1.0";

function isConfiguredEnvValue(
  value: string | undefined,
  placeholders: string[],
) {
  if (!value?.trim()) return false;
  return !placeholders.includes(value.trim());
}

export async function ensureGlobalOneDriveProviderConfig(): Promise<ProviderConfig | null> {
  const existing = await prisma.providerConfig.findFirst({
    where: { userId: null, provider: "onedrive", status: "active" },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;

  const clientId = env.ONEDRIVE_CLIENT_ID?.trim();
  const clientSecret = env.ONEDRIVE_CLIENT_SECRET?.trim();
  const redirectUri = env.ONEDRIVE_REDIRECT_URI;

  const hasClientId = isConfiguredEnvValue(clientId, [
    "your-onedrive-client-id",
    "your-client-id",
    "build-onedrive-client-id",
  ]);
  const hasClientSecret = isConfiguredEnvValue(clientSecret, [
    "your-onedrive-client-secret",
    "your-client-secret",
    "build-onedrive-client-secret",
  ]);
  if (!hasClientId || !hasClientSecret) return null;

  await prisma.providerConfig.updateMany({
    where: { userId: null, provider: "onedrive", status: "active" },
    data: { status: "disabled" },
  });

  return prisma.providerConfig.create({
    data: {
      userId: null,
      provider: "onedrive",
      clientIdEncrypted: encryptText(clientId!),
      clientSecretEncrypted: encryptText(clientSecret!),
      redirectUri,
      scopes: onedriveOAuthScopes,
      status: "active",
    },
  });
}

export function buildOneDriveAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes: string[];
}) {
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", params.scopes.join(" "));
  url.searchParams.set("state", params.state);
  return url.toString();
}

type OneDriveTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

export async function exchangeOneDriveCode(params: {
  config: ProviderConfig;
  code: string;
}): Promise<OneDriveTokenResponse> {
  const body = new URLSearchParams({
    client_id: decryptText(params.config.clientIdEncrypted),
    client_secret: decryptText(params.config.clientSecretEncrypted),
    code: params.code,
    redirect_uri: params.config.redirectUri,
    grant_type: "authorization_code",
  });
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    throw new Error(`OneDrive token exchange failed: ${await response.text()}`);
  }
  return (await response.json()) as OneDriveTokenResponse;
}

async function refreshOneDriveAccessToken(account: ConnectedAccount) {
  if (!account.refreshTokenEncrypted || !account.providerConfigId) {
    throw new Error("OneDrive refresh token or provider config missing.");
  }
  const config = await prisma.providerConfig.findUniqueOrThrow({
    where: { id: account.providerConfigId },
  });
  const body = new URLSearchParams({
    client_id: decryptText(config.clientIdEncrypted),
    client_secret: decryptText(config.clientSecretEncrypted),
    refresh_token: decryptText(account.refreshTokenEncrypted),
    grant_type: "refresh_token",
  });
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    throw new Error(`OneDrive token refresh failed: ${await response.text()}`);
  }
  const tokens = (await response.json()) as OneDriveTokenResponse;
  if (!tokens.access_token) {
    throw new Error("OneDrive refresh did not return access_token.");
  }
  const tokenExpiresAt = new Date(
    Date.now() + (tokens.expires_in ?? 3600) * 1000,
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

export async function getOneDriveAccessToken(account: ConnectedAccount) {
  if (!account.accessTokenEncrypted) {
    throw new Error("OneDrive access token missing.");
  }
  const expiresSoon =
    !account.tokenExpiresAt ||
    account.tokenExpiresAt.getTime() < Date.now() + 60_000;
  if (expiresSoon && account.refreshTokenEncrypted) {
    return refreshOneDriveAccessToken(account);
  }
  return decryptText(account.accessTokenEncrypted);
}

async function graphFetch(
  account: ConnectedAccount,
  path: string,
  init?: RequestInit,
) {
  const accessToken = await getOneDriveAccessToken(account);
  const response = await fetch(`${GRAPH}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });
  return response;
}

async function graphJson<T>(
  account: ConnectedAccount,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await graphFetch(account, path, init);
  if (!response.ok) {
    throw new Error(`OneDrive Graph ${path} failed: ${await response.text()}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function getOneDriveProfileWithToken(accessToken: string) {
  const response = await fetch(`${GRAPH}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`OneDrive profile failed: ${await response.text()}`);
  }
  return (await response.json()) as {
    id: string;
    displayName?: string;
    mail?: string;
    userPrincipalName?: string;
  };
}

export async function syncOneDriveQuota(accountId: string) {
  const account = await prisma.connectedAccount.findUniqueOrThrow({
    where: { id: accountId },
  });
  const drive = await graphJson<{
    quota?: { total?: number; used?: number; remaining?: number };
  }>(account, "/me/drive");
  const total =
    drive.quota?.total != null ? BigInt(drive.quota.total) : null;
  const used = BigInt(drive.quota?.used ?? 0);
  const available =
    drive.quota?.remaining != null
      ? BigInt(drive.quota.remaining)
      : total === null
        ? null
        : total - used;

  return prisma.storageAccount.upsert({
    where: { connectedAccountId: accountId },
    create: {
      connectedAccountId: accountId,
      totalBytes: total,
      usedBytes: used,
      availableBytes: available,
      lastSyncedAt: new Date(),
    },
    update: {
      totalBytes: total,
      usedBytes: used,
      availableBytes: available,
      lastSyncedAt: new Date(),
    },
  });
}

type DriveItem = {
  id: string;
  name: string;
  size?: number;
  lastModifiedDateTime?: string;
  folder?: unknown;
  file?: { mimeType?: string };
  parentReference?: { path?: string; id?: string };
};

export async function browseOneDriveFolder(
  accountId: string,
  userId: string,
  parentId: string,
  searchQuery?: string,
): Promise<ProviderBrowseResult> {
  const account = await prisma.connectedAccount.findFirstOrThrow({
    where: {
      id: accountId,
      userId,
      provider: "onedrive",
      status: "connected",
    },
  });

  const path =
    !parentId || parentId === "root"
      ? "/me/drive/root/children"
      : `/me/drive/items/${encodeURIComponent(parentId)}/children`;

  let items: DriveItem[] = [];
  let next: string | null = path;
  while (next) {
    const requestPath = next.startsWith("http")
      ? next.replace(GRAPH, "")
      : next;
    const page: {
      value?: DriveItem[];
      "@odata.nextLink"?: string;
    } = await graphJson(account, requestPath);
    items = items.concat(page.value ?? []);
    next = page["@odata.nextLink"]
      ? page["@odata.nextLink"].replace(GRAPH, "")
      : null;
  }

  const q = searchQuery?.trim().toLowerCase();
  if (q) {
    items = items.filter((item) => item.name.toLowerCase().includes(q));
  }

  const folders = items
    .filter((item) => Boolean(item.folder))
    .map((item) => ({
      id: item.id,
      name: item.name,
      modifiedTime: item.lastModifiedDateTime ?? new Date().toISOString(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const files = items
    .filter((item) => !item.folder)
    .map((item) => ({
      id: item.id,
      name: item.name,
      mimeType: item.file?.mimeType ?? "application/octet-stream",
      sizeBytes: String(item.size ?? 0),
      modifiedTime: item.lastModifiedDateTime ?? new Date().toISOString(),
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
    { id: "root", name: "OneDrive" },
  ];
  if (parentId && parentId !== "root") {
    try {
      const item = await graphJson<DriveItem>(
        account,
        `/me/drive/items/${encodeURIComponent(parentId)}?$select=id,name,parentReference`,
      );
      breadcrumbs.push({ id: item.id, name: item.name });
    } catch {
      breadcrumbs.push({ id: parentId, name: "Folder" });
    }
  }

  return { folders, files, breadcrumbs };
}

export async function ensureOneDriveAppFolder(account: ConnectedAccount) {
  const children = await graphJson<{ value: DriveItem[] }>(
    account,
    "/me/drive/root/children",
  );
  const existing = (children.value ?? []).find(
    (item) => item.folder && item.name === APP_FOLDER_NAME,
  );
  if (existing) return existing.id;

  const created = await graphJson<DriveItem>(account, "/me/drive/root/children", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: APP_FOLDER_NAME,
      folder: {},
      "@microsoft.graph.conflictBehavior": "rename",
    }),
  });
  return created.id;
}

export async function getOneDriveFileMetadata(
  account: ConnectedAccount,
  itemId: string,
) {
  return graphJson<DriveItem>(
    account,
    `/me/drive/items/${encodeURIComponent(itemId)}?$select=id,name,size,file,folder,lastModifiedDateTime`,
  );
}

export async function downloadOneDriveFileStream(
  account: ConnectedAccount,
  itemId: string,
) {
  const response = await graphFetch(
    account,
    `/me/drive/items/${encodeURIComponent(itemId)}/content`,
  );
  if (!response.ok || !response.body) {
    throw new Error(`OneDrive download failed: ${await response.text()}`);
  }
  return Readable.fromWeb(response.body as import("stream/web").ReadableStream);
}

function toBody(chunk: Buffer): BodyInit {
  return new Blob([new Uint8Array(chunk)]);
}

export async function uploadOneDriveFileFromStream(params: {
  account: ConnectedAccount;
  parentId: string;
  fileName: string;
  mimeType: string;
  body: Readable;
  sizeBytes?: bigint;
}) {
  const accessToken = await getOneDriveAccessToken(params.account);
  const parentId = params.parentId === "root" ? "root" : params.parentId;
  const chunks: Buffer[] = [];
  for await (const piece of params.body) {
    chunks.push(Buffer.isBuffer(piece) ? piece : Buffer.from(piece));
  }
  const buffer = Buffer.concat(chunks);
  const size = buffer.byteLength;

  if (size <= 4 * 1024 * 1024) {
    const path =
      parentId === "root"
        ? `/me/drive/root:/${encodeURIComponent(params.fileName)}:/content`
        : `/me/drive/items/${encodeURIComponent(parentId)}:/${encodeURIComponent(params.fileName)}:/content`;
    const response = await fetch(`${GRAPH}${path}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": params.mimeType || "application/octet-stream",
      },
      body: toBody(buffer),
    });
    if (!response.ok) {
      throw new Error(`OneDrive upload failed: ${await response.text()}`);
    }
    const uploaded = (await response.json()) as DriveItem;
    return {
      id: uploaded.id,
      name: uploaded.name,
      size: uploaded.size ?? size,
      mimeType: uploaded.file?.mimeType ?? params.mimeType,
    };
  }

  const sessionPath =
    parentId === "root"
      ? `/me/drive/root:/${encodeURIComponent(params.fileName)}:/createUploadSession`
      : `/me/drive/items/${encodeURIComponent(parentId)}:/${encodeURIComponent(params.fileName)}:/createUploadSession`;
  const session = await graphJson<{ uploadUrl: string }>(
    params.account,
    sessionPath,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item: {
          "@microsoft.graph.conflictBehavior": "rename",
          name: params.fileName,
        },
      }),
    },
  );

  const CHUNK = 5 * 1024 * 1024;
  let offset = 0;
  let uploaded: DriveItem | null = null;
  while (offset < size) {
    const end = Math.min(offset + CHUNK, size);
    const slice = buffer.subarray(offset, end);
    const response = await fetch(session.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": String(slice.byteLength),
        "Content-Range": `bytes ${offset}-${end - 1}/${size}`,
      },
      body: toBody(slice),
    });
    if (!(response.status === 202 || response.ok)) {
      throw new Error(
        `OneDrive session upload failed: ${await response.text()}`,
      );
    }
    if (response.status === 201 || response.status === 200) {
      uploaded = (await response.json()) as DriveItem;
    }
    offset = end;
  }
  if (!uploaded) {
    throw new Error("OneDrive upload session completed without file metadata.");
  }
  return {
    id: uploaded.id,
    name: uploaded.name,
    size: uploaded.size ?? size,
    mimeType: uploaded.file?.mimeType ?? params.mimeType,
  };
}

export async function deleteOneDriveFile(
  account: ConnectedAccount,
  itemId: string,
) {
  const response = await graphFetch(
    account,
    `/me/drive/items/${encodeURIComponent(itemId)}`,
    { method: "DELETE" },
  );
  if (!response.ok && response.status !== 204) {
    throw new Error(`OneDrive delete failed: ${await response.text()}`);
  }
}
