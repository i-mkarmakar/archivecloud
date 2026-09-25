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

type PCloudEnv = typeof env & {
  PCLOUD_CLIENT_ID?: string;
  PCLOUD_CLIENT_SECRET?: string;
  PCLOUD_REDIRECT_URI?: string;
};

const pcloudEnv = env as PCloudEnv;

const APP_FOLDER_NAME = "archivecloud";
const PCLOUD_AUTH_URL = "https://my.pcloud.com/oauth2/authorize";
const PCLOUD_API_US = "https://api.pcloud.com";
const PCLOUD_API_EU = "https://eapi.pcloud.com";
const PCLOUD_HOST_SCOPE_PREFIX = "pcloud_host:";

function resolvePCloudApiBase(hostname?: string | null) {
  const host = (hostname ?? "").trim().toLowerCase();
  if (host === "eapi.pcloud.com") return PCLOUD_API_EU;
  if (host === "api.pcloud.com") return PCLOUD_API_US;
  return PCLOUD_API_US;
}

function pcloudHostScope(apiBase: string) {
  const host = new URL(apiBase).hostname;
  return `${PCLOUD_HOST_SCOPE_PREFIX}${host}`;
}

export function getPCloudApiBaseForAccount(account: {
  scopes: unknown;
}): string {
  if (Array.isArray(account.scopes)) {
    for (const scope of account.scopes) {
      if (
        typeof scope === "string" &&
        scope.startsWith(PCLOUD_HOST_SCOPE_PREFIX)
      ) {
        return resolvePCloudApiBase(
          scope.slice(PCLOUD_HOST_SCOPE_PREFIX.length),
        );
      }
    }
  }
  return PCLOUD_API_US;
}

function isConfiguredEnvValue(
  value: string | undefined,
  placeholders: string[],
) {
  if (!value?.trim()) return false;
  return !placeholders.includes(value.trim());
}

function pcloudRedirectUri() {
  return (
    pcloudEnv.PCLOUD_REDIRECT_URI?.trim() ||
    `${env.APP_URL}/connected-accounts/pcloud/callback`
  );
}

export async function ensureGlobalPCloudProviderConfig(): Promise<ProviderConfig | null> {
  const clientId = pcloudEnv.PCLOUD_CLIENT_ID?.trim();
  const clientSecret = pcloudEnv.PCLOUD_CLIENT_SECRET?.trim();
  const redirectUri = pcloudRedirectUri();

  const hasClientId = isConfiguredEnvValue(clientId, [
    "your-pcloud-client-id",
    "your-client-id",
    "build-pcloud-client-id",
  ]);
  const hasClientSecret = isConfiguredEnvValue(clientSecret, [
    "your-pcloud-client-secret",
    "your-client-secret",
    "build-pcloud-client-secret",
  ]);
  if (!hasClientId || !hasClientSecret) return null;
  if (!clientId || !clientSecret) return null;

  const existing = await prisma.providerConfig.findFirst({
    where: { userId: null, provider: "pcloud", status: "active" },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    const sameId = decryptText(existing.clientIdEncrypted) === clientId;
    const sameSecret =
      decryptText(existing.clientSecretEncrypted) === clientSecret;
    const sameRedirect = existing.redirectUri === redirectUri;
    if (sameId && sameSecret && sameRedirect) return existing;

    // Env changed — rotate the stored global config so OAuth uses current secrets.
    await prisma.providerConfig.update({
      where: { id: existing.id },
      data: {
        clientIdEncrypted: encryptText(clientId),
        clientSecretEncrypted: encryptText(clientSecret),
        redirectUri,
        status: "active",
      },
    });
    return prisma.providerConfig.findUniqueOrThrow({
      where: { id: existing.id },
    });
  }

  await prisma.providerConfig.updateMany({
    where: { userId: null, provider: "pcloud", status: "active" },
    data: { status: "disabled" },
  });

  return prisma.providerConfig.create({
    data: {
      userId: null,
      provider: "pcloud",
      clientIdEncrypted: encryptText(clientId),
      clientSecretEncrypted: encryptText(clientSecret),
      redirectUri,
      scopes: [],
      status: "active",
    },
  });
}

export function buildPCloudAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}) {
  const url = new URL(PCLOUD_AUTH_URL);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", params.state);
  return url.toString();
}

type PCloudTokenResponse = {
  result: number;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  uid?: number | string;
  userid?: number | string;
  error?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parsePCloudTokenJson(data: unknown): PCloudTokenResponse {
  if (!isRecord(data) || typeof data.result !== "number") {
    throw new Error("pCloud token response was malformed.");
  }
  return {
    result: data.result,
    access_token:
      typeof data.access_token === "string" ? data.access_token : undefined,
    refresh_token:
      typeof data.refresh_token === "string" ? data.refresh_token : undefined,
    expires_in:
      typeof data.expires_in === "number" ? data.expires_in : undefined,
    token_type:
      typeof data.token_type === "string" ? data.token_type : undefined,
    uid:
      typeof data.uid === "number" || typeof data.uid === "string"
        ? data.uid
        : undefined,
    userid:
      typeof data.userid === "number" || typeof data.userid === "string"
        ? data.userid
        : undefined,
    error: typeof data.error === "string" ? data.error : undefined,
  };
}

type PCloudApiResponse<T> = {
  result: number;
  error?: string;
} & T;

export function resolvePCloudUserId(tokens: {
  uid?: number | string;
  userid?: number | string;
}) {
  const raw = tokens.uid ?? tokens.userid;
  if (raw === undefined || raw === null) return "";
  return String(raw).trim();
}

async function parsePCloudTokenResponse(
  response: Response,
): Promise<PCloudTokenResponse> {
  const data = parsePCloudTokenJson(await response.json());
  if (!response.ok || data.result !== 0 || !data.access_token) {
    throw new Error(
      `pCloud token request failed: ${data.error ?? JSON.stringify(data)}`,
    );
  }
  return data;
}

export async function exchangePCloudCode(params: {
  config: ProviderConfig;
  code: string;
  /** Ignored for token exchange — pCloud docs fix this endpoint to api.pcloud.com. */
  apiBase?: string;
}): Promise<PCloudTokenResponse> {
  // Per https://docs.pcloud.com/methods/oauth_2.0/oauth2_token.html
  // Required: client_id, client_secret, code. URL is always api.pcloud.com.
  // Regional hostname from authorize applies to later API calls, not this step.
  const url = new URL(`${PCLOUD_API_US}/oauth2_token`);
  url.searchParams.set(
    "client_id",
    decryptText(params.config.clientIdEncrypted),
  );
  url.searchParams.set(
    "client_secret",
    decryptText(params.config.clientSecretEncrypted),
  );
  url.searchParams.set("code", params.code);

  // pCloud HTTP JSON methods are typically GET + query params.
  const getResponse = await fetch(url);
  try {
    return await parsePCloudTokenResponse(getResponse);
  } catch (getError) {
    // Fallback to POST form body for clients that expect classic OAuth.
    const body = new URLSearchParams({
      client_id: decryptText(params.config.clientIdEncrypted),
      client_secret: decryptText(params.config.clientSecretEncrypted),
      code: params.code,
    });
    const postResponse = await fetch(`${PCLOUD_API_US}/oauth2_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    try {
      return await parsePCloudTokenResponse(postResponse);
    } catch {
      throw getError;
    }
  }
}

async function refreshPCloudAccessToken(account: ConnectedAccount) {
  if (!account.refreshTokenEncrypted || !account.providerConfigId) {
    throw new Error("pCloud refresh token or provider config missing.");
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
  // Token endpoint is documented only on api.pcloud.com.
  const response = await fetch(`${PCLOUD_API_US}/oauth2_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tokens = await parsePCloudTokenResponse(response);
  const tokenExpiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000)
    : null;
  await prisma.connectedAccount.update({
    where: { id: account.id },
    data: {
      accessTokenEncrypted: encryptText(tokens.access_token!),
      tokenExpiresAt,
      ...(tokens.refresh_token
        ? { refreshTokenEncrypted: encryptText(tokens.refresh_token) }
        : {}),
    },
  });
  return tokens.access_token!;
}

export async function getPCloudAccessToken(account: ConnectedAccount) {
  if (!account.accessTokenEncrypted) {
    throw new Error("pCloud access token missing.");
  }
  // pCloud OAuth access tokens do not expire in the current API
  // (https://docs.pcloud.com/methods/oauth_2.0/). Only refresh if we have a
  // refresh token and an explicit expiry that is near.
  const expiresSoon =
    account.tokenExpiresAt != null &&
    account.tokenExpiresAt.getTime() < Date.now() + 60_000;
  if (expiresSoon && account.refreshTokenEncrypted) {
    try {
      return await refreshPCloudAccessToken(account);
    } catch (error) {
      console.error(
        "pCloud token refresh failed; using existing token:",
        error,
      );
    }
  }
  return decryptText(account.accessTokenEncrypted);
}

async function pcloudApi<T>(
  account: ConnectedAccount,
  method: string,
  params: Record<string, string | number | boolean | undefined> = {},
): Promise<T> {
  const accessToken = await getPCloudAccessToken(account);
  const apiBase = getPCloudApiBaseForAccount(account);
  const url = new URL(`${apiBase}/${method}`);
  url.searchParams.set("access_token", accessToken);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await response.json()) as PCloudApiResponse<T>;
  if (!response.ok || data.result !== 0) {
    throw new Error(
      `pCloud API ${method} failed: ${data.error ?? JSON.stringify(data)}`,
    );
  }
  return data as T;
}

export async function getPCloudAccountInfoWithToken(params: {
  accessToken: string;
  apiBase: string;
}) {
  const bases = Array.from(
    new Set([params.apiBase, PCLOUD_API_US, PCLOUD_API_EU]),
  );

  let lastError: Error | null = null;
  for (const apiBase of bases) {
    try {
      const url = new URL(`${apiBase}/userinfo`);
      url.searchParams.set("access_token", params.accessToken);
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${params.accessToken}` },
      });
      const data = (await response.json()) as PCloudApiResponse<{
        email?: string;
        userid?: number | string;
        premium?: boolean;
        quota?: number;
        usedquota?: number;
      }>;
      if (!response.ok || data.result !== 0) {
        throw new Error(
          `pCloud API userinfo failed on ${apiBase}: ${data.error ?? JSON.stringify(data)}`,
        );
      }
      return data;
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("pCloud userinfo failed");
    }
  }

  throw lastError ?? new Error("pCloud userinfo failed");
}

export async function getPCloudAccountInfo(account: ConnectedAccount) {
  return pcloudApi<{
    email?: string;
    userid?: number | string;
    premium?: boolean;
    quota?: number;
    usedquota?: number;
  }>(account, "userinfo");
}

export function buildPCloudScopes(params: {
  existingScopes: unknown;
  apiBase: string;
}): string[] {
  const base = Array.isArray(params.existingScopes)
    ? params.existingScopes.filter(
        (scope): scope is string =>
          typeof scope === "string" &&
          !scope.startsWith(PCLOUD_HOST_SCOPE_PREFIX),
      )
    : [];
  return [...base, pcloudHostScope(params.apiBase)];
}

export async function syncPCloudQuota(accountId: string) {
  const account = await prisma.connectedAccount.findUniqueOrThrow({
    where: { id: accountId },
  });
  const info = await getPCloudAccountInfo(account);
  const total = info.quota != null ? BigInt(info.quota) : null;
  const used = BigInt(info.usedquota ?? 0);
  const available = total === null ? null : total - used;

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

function toPCloudFolderId(parentId: string) {
  if (!parentId || parentId === "root") return 0;
  const parsed = Number(parentId);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid pCloud folder id: ${parentId}`);
  }
  return parsed;
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

type PCloudEntry = {
  isfolder?: boolean;
  isdeleted?: boolean;
  fileid?: number;
  folderid?: number;
  name: string;
  size?: number;
  contenttype?: string;
  modified?: number | string;
  created?: number | string;
};

function pcloudTimestampToIso(value: number | string | undefined): string {
  if (value == null || value === "") return new Date().toISOString();

  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value;
    const parsed = new Date(ms);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      return pcloudTimestampToIso(Number(trimmed));
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  return new Date().toISOString();
}

export async function browsePCloudFolder(
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
      provider: "pcloud",
      status: "connected",
    },
  });

  const folderId = toPCloudFolderId(parentId);
  const listed = await pcloudApi<{ metadata: { contents?: PCloudEntry[] } }>(
    account,
    "listfolder",
    { folderid: folderId, recursive: 0 },
  );

  let entries = (listed.metadata?.contents ?? []).filter(
    (entry) => !entry.isdeleted,
  );
  if (options?.limit) {
    entries = entries.slice(0, options.limit);
  }

  const q = searchQuery?.trim().toLowerCase();
  if (q) {
    entries = entries.filter((entry) => entry.name.toLowerCase().includes(q));
  }

  const folders = entries
    .filter((entry) => entry.isfolder)
    .map((entry) => ({
      id: String(entry.folderid ?? entry.name),
      name: entry.name,
      modifiedTime: pcloudTimestampToIso(entry.modified ?? entry.created),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const files = entries
    .filter((entry) => !entry.isfolder)
    .map((entry) => ({
      id: String(entry.fileid ?? entry.name),
      name: entry.name,
      mimeType: entry.contenttype ?? guessMimeType(entry.name),
      sizeBytes: String(entry.size ?? 0),
      modifiedTime: pcloudTimestampToIso(entry.modified ?? entry.created),
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
    { id: "root", name: "pCloud" },
  ];
  if (folderId !== 0) {
    try {
      const stat = await pcloudApi<{
        metadata: { folderid?: number; name?: string; path?: string };
      }>(account, "stat", { folderid: folderId });
      const path = stat.metadata?.path;
      if (path) {
        const parts = path.split("/").filter(Boolean);
        let currentId = 0;
        for (const part of parts) {
          const folderListing = await pcloudApi<{
            metadata: { contents?: PCloudEntry[] };
          }>(account, "listfolder", { folderid: currentId, recursive: 0 });
          const match = (folderListing.metadata?.contents ?? []).find(
            (entry) => entry.isfolder && entry.name === part,
          );
          if (!match?.folderid) break;
          currentId = match.folderid;
          breadcrumbs.push({ id: String(currentId), name: part });
        }
      } else if (stat.metadata?.name) {
        breadcrumbs.push({
          id: String(stat.metadata.folderid ?? folderId),
          name: stat.metadata.name,
        });
      }
    } catch {
      breadcrumbs.push({ id: String(folderId), name: "Folder" });
    }
  }

  return { folders, files, breadcrumbs };
}

export async function ensurePCloudAppFolder(account: ConnectedAccount) {
  const created = await pcloudApi<{ metadata: { folderid: number } }>(
    account,
    "createfolderifnotexists",
    { folderid: 0, name: APP_FOLDER_NAME },
  );
  return String(created.metadata.folderid);
}

export async function getPCloudFileMetadata(
  account: ConnectedAccount,
  fileId: string,
) {
  return pcloudApi<{
    metadata: {
      fileid: number;
      name: string;
      size?: number;
      contenttype?: string;
      modified?: number;
      isfolder?: boolean;
    };
  }>(account, "stat", { fileid: Number(fileId) });
}

export async function downloadPCloudFileStream(
  account: ConnectedAccount,
  fileId: string,
) {
  const accessToken = await getPCloudAccessToken(account);
  const apiBase = getPCloudApiBaseForAccount(account);
  const url = new URL(`${apiBase}/downloadfile`);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("fileid", fileId);
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    const text = await response.text();
    throw new Error(`pCloud download failed: ${text}`);
  }
  return Readable.fromWeb(response.body as import("stream/web").ReadableStream);
}

function toBody(chunk: Buffer): BodyInit {
  return new Blob([new Uint8Array(chunk)]);
}

export async function uploadPCloudFileFromStream(params: {
  account: ConnectedAccount;
  folderId: string | number;
  fileName: string;
  body: Readable;
  sizeBytes?: bigint;
}) {
  const accessToken = await getPCloudAccessToken(params.account);
  const apiBase = getPCloudApiBaseForAccount(params.account);
  const chunks: Buffer[] = [];
  for await (const piece of params.body) {
    chunks.push(Buffer.isBuffer(piece) ? piece : Buffer.from(piece));
  }
  const buffer = Buffer.concat(chunks);

  const url = new URL(`${apiBase}/uploadfile`);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("folderid", String(params.folderId));
  url.searchParams.set("filename", params.fileName);
  url.searchParams.set("nopartial", "1");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      ...(params.sizeBytes !== undefined
        ? { "Content-Length": String(params.sizeBytes) }
        : { "Content-Length": String(buffer.byteLength) }),
    },
    body: toBody(buffer),
  });
  const data = (await response.json()) as PCloudApiResponse<{
    metadata: {
      fileid: number;
      name: string;
      size?: number;
      contenttype?: string;
    };
  }>;
  if (!response.ok || data.result !== 0) {
    throw new Error(
      `pCloud upload failed: ${data.error ?? JSON.stringify(data)}`,
    );
  }
  return data.metadata;
}

export async function deletePCloudFile(
  account: ConnectedAccount,
  fileId: string,
) {
  await pcloudApi(account, "deletefile", { fileid: Number(fileId) });
}
