import "server-only";

import { Readable } from "node:stream";
import type { ConnectedAccount } from "@/generated/prisma/client";
import { prisma } from "@/server/config/prisma";
import type { ICloudClient } from "@/server/modules/icloud/icloud-client";
import {
  createICloudClient,
  getReadyICloudClient,
  sessionFromClient,
  stashPendingICloudAuth,
  takePendingICloudAuth,
  type ICloudStoredSession,
} from "@/server/modules/icloud/icloud-session";
import type {
  ProviderBrowseResult,
  ProviderCopyResult,
  SupportedProvider,
} from "@/server/modules/providers/types";
import { assertProviderCapability } from "@/server/modules/providers/types";
import { decryptText, encryptText } from "@/server/utils/crypto";

type ICloudProvider = Extract<
  SupportedProvider,
  "icloud_drive" | "icloud_photos"
>;

const DRIVE_ROOT = "FOLDER::com.apple.CloudDocs::root";
const HIDDEN_ALBUMS = new Set(["Recently Deleted", "Hidden"]);

const SMART_ALBUMS: Record<
  string,
  {
    type: string;
    direction: string;
    query_filter: Array<Record<string, unknown>> | null;
  }
> = {
  "All Photos": {
    type: "CPLAssetAndMasterByAssetDateWithoutHiddenOrDeleted",
    direction: "ASCENDING",
    query_filter: null,
  },
  Favorites: {
    type: "CPLAssetAndMasterInSmartAlbumByAssetDate",
    direction: "ASCENDING",
    query_filter: [
      {
        fieldName: "smartAlbum",
        comparator: "EQUALS",
        fieldValue: { type: "STRING", value: "FAVORITE" },
      },
    ],
  },
  Videos: {
    type: "CPLAssetAndMasterInSmartAlbumByAssetDate",
    direction: "ASCENDING",
    query_filter: [
      {
        fieldName: "smartAlbum",
        comparator: "EQUALS",
        fieldValue: { type: "STRING", value: "VIDEO" },
      },
    ],
  },
  Screenshots: {
    type: "CPLAssetAndMasterInSmartAlbumByAssetDate",
    direction: "ASCENDING",
    query_filter: [
      {
        fieldName: "smartAlbum",
        comparator: "EQUALS",
        fieldValue: { type: "STRING", value: "SCREENSHOT" },
      },
    ],
  },
};

type DriveFileRef = {
  drivewsid: string;
  docwsid: string;
  etag: string;
  size: number;
  name: string;
};

type PhotoRecord = {
  recordName: string;
  recordType: string;
  recordChangeTag?: string;
  fields?: Record<string, { value?: unknown }>;
};

function encodeDriveFileRef(ref: DriveFileRef): string {
  return `idrf:${Buffer.from(JSON.stringify(ref)).toString("base64url")}`;
}

function decodeDriveFileRef(id: string): DriveFileRef | null {
  if (!id.startsWith("idrf:")) return null;
  try {
    return JSON.parse(
      Buffer.from(id.slice(5), "base64url").toString("utf8"),
    ) as DriveFileRef;
  } catch {
    return null;
  }
}

function driveParentId(parentId: string): string {
  if (!parentId || parentId === "root") return DRIVE_ROOT;
  return parentId;
}

function guessMime(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".heic")) return "image/heic";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

function readSession(account: ConnectedAccount): ICloudStoredSession {
  if (!account.accessTokenEncrypted) {
    throw new Error("iCloud account has no stored session.");
  }
  const raw = JSON.parse(
    decryptText(account.accessTokenEncrypted),
  ) as Partial<ICloudStoredSession>;
  if (!raw.appleId || !raw.password) {
    throw new Error("iCloud session invalid. Disconnect and reconnect.");
  }
  return {
    appleId: raw.appleId,
    password: raw.password,
    trustToken: raw.trustToken,
    sessionToken: raw.sessionToken,
    cookies: raw.cookies ?? [],
    accountInfo: raw.accountInfo,
    accountCountry: raw.accountCountry,
  };
}

async function persistSession(accountId: string, session: ICloudStoredSession) {
  return prisma.connectedAccount.update({
    where: { id: accountId },
    data: {
      accessTokenEncrypted: encryptText(JSON.stringify(session)),
      status: "connected",
      lastError: null,
    },
  });
}

async function withReadyClient<T>(
  account: ConnectedAccount,
  fn: (client: ICloudClient) => Promise<T>,
): Promise<T> {
  const session = readSession(account);
  const { client, refreshed } = await getReadyICloudClient(session);
  if (refreshed) await persistSession(account.id, refreshed);
  return fn(client);
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (typeof body === "string") return Buffer.from(body);
  if (body && typeof (body as Readable).pipe === "function") {
    const chunks: Buffer[] = [];
    for await (const chunk of body as Readable) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  throw new Error("Unsupported upload body.");
}

function photosEndpoint(client: ICloudClient): string {
  return `${client.webserviceUrl("ckdatabasews")}/database/1/com.apple.photos.cloud/production/private`;
}

async function photosPost(
  client: ICloudClient,
  path: string,
  body: unknown,
): Promise<unknown> {
  const params = new URLSearchParams({
    remapEnums: "true",
    getCurrentSyncToken: "true",
  });
  const dsid = client.dsid();
  if (dsid) params.set("dsid", dsid);
  const res = await fetch(`${photosEndpoint(client)}${path}?${params}`, {
    method: "POST",
    headers: {
      ...client.apiHeaders(),
      "Content-Type": "text/plain",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as {
    error?: string;
    reason?: string;
    serverErrorCode?: string;
  } | null;
  if (!res.ok) {
    const code = json?.serverErrorCode || json?.error || String(res.status);
    if (code === "ZONE_NOT_FOUND") {
      throw new Error(
        "iCloud Photos library not found. On an iPhone/Mac enable iCloud Photos, open icloud.com/photos once, wait for sync, then Sync again.",
      );
    }
    throw new Error(
      json?.reason
        ? `iCloud Photos failed: ${json.reason}`
        : `iCloud Photos request failed (${res.status}).`,
    );
  }
  if (json?.error) {
    throw new Error(`${json.error}: ${json.reason ?? "Photos request failed"}`);
  }
  return json;
}

async function ensurePhotosZone(client: ICloudClient): Promise<void> {
  const listed = (await photosPost(client, "/zones/list", {})) as {
    zones?: Array<{ zoneID?: { zoneName?: string } }>;
  };
  const hasPrimary = (listed.zones ?? []).some(
    (z) => z.zoneID?.zoneName === "PrimarySync",
  );
  if (hasPrimary) return;
  throw new Error(
    "iCloud Photos library not found. On an iPhone/Mac enable iCloud Photos, open icloud.com/photos once, wait for sync, then Sync again.",
  );
}

async function listPhotoAlbums(client: ICloudClient): Promise<string[]> {
  const names = Object.keys(SMART_ALBUMS);
  const json = (await photosPost(client, "/records/query", {
    query: { recordType: "CPLAlbumByPositionLive" },
    zoneID: { zoneName: "PrimarySync", zoneType: "REGULAR_CUSTOM_ZONE" },
  })) as { records?: PhotoRecord[] };

  for (const folder of json.records ?? []) {
    const enc = folder.fields?.albumNameEnc?.value;
    if (typeof enc !== "string") continue;
    if (folder.recordName === "----Root-Folder----") continue;
    if (folder.fields?.isDeleted?.value) continue;
    const name = Buffer.from(enc, "base64").toString("utf8");
    if (!HIDDEN_ALBUMS.has(name) && !names.includes(name)) names.push(name);
  }
  return names;
}

function albumQuery(albumName: string) {
  if (SMART_ALBUMS[albumName]) return SMART_ALBUMS[albumName];
  return {
    type: "CPLContainerRelationLiveByAssetDate",
    direction: "ASCENDING",
    query_filter: [
      {
        fieldName: "parentId",
        comparator: "EQUALS",
        fieldValue: { type: "STRING", value: albumName },
      },
    ],
  };
}

async function listAlbumPhotos(
  client: ICloudClient,
  albumName: string,
  limit = 200,
): Promise<
  Array<{
    id: string;
    name: string;
    size: number;
    modifiedTime: string;
    downloadUrl?: string;
    assetRecordName?: string;
    changeTag?: string;
  }>
> {
  const album = albumQuery(albumName);
  // User albums need folder recordName as parentId; resolve by name if needed.
  let queryFilter = album.query_filter;
  if (!SMART_ALBUMS[albumName]) {
    const folders = (await photosPost(client, "/records/query", {
      query: { recordType: "CPLAlbumByPositionLive" },
      zoneID: { zoneName: "PrimarySync", zoneType: "REGULAR_CUSTOM_ZONE" },
    })) as { records?: PhotoRecord[] };
    const match = (folders.records ?? []).find((folder) => {
      const enc = folder.fields?.albumNameEnc?.value;
      if (typeof enc !== "string") return false;
      return Buffer.from(enc, "base64").toString("utf8") === albumName;
    });
    if (!match) return [];
    queryFilter = [
      {
        fieldName: "parentId",
        comparator: "EQUALS",
        fieldValue: { type: "STRING", value: match.recordName },
      },
    ];
  }

  const json = (await photosPost(client, "/records/query", {
    query: {
      filterBy: [
        {
          fieldName: "startRank",
          fieldValue: { type: "INT64", value: 0 },
          comparator: "EQUALS",
        },
        {
          fieldName: "direction",
          fieldValue: { type: "STRING", value: album.direction },
          comparator: "EQUALS",
        },
        ...(queryFilter ?? []),
      ],
      recordType: album.type,
    },
    resultsLimit: Math.min(limit, 200) * 2,
    desiredKeys: [
      "filenameEnc",
      "resOriginalRes",
      "resOriginalFileType",
      "masterRef",
      "assetDate",
      "recordName",
      "recordChangeTag",
    ],
    zoneID: { zoneName: "PrimarySync" },
  })) as { records?: PhotoRecord[] };

  const assets = new Map<string, PhotoRecord>();
  const masters: PhotoRecord[] = [];
  for (const rec of json.records ?? []) {
    if (rec.recordType === "CPLAsset") {
      const masterId = (
        rec.fields?.masterRef?.value as { recordName?: string } | undefined
      )?.recordName;
      if (masterId) assets.set(masterId, rec);
    } else if (rec.recordType === "CPLMaster") {
      masters.push(rec);
    }
  }

  return masters.slice(0, limit).map((master) => {
    const enc = master.fields?.filenameEnc?.value;
    const name =
      typeof enc === "string"
        ? Buffer.from(enc, "base64").toString("utf8")
        : "photo";
    const res = master.fields?.resOriginalRes?.value as
      | { size?: number; downloadURL?: string }
      | undefined;
    const asset = assets.get(master.recordName);
    const assetDate = asset?.fields?.assetDate?.value;
    return {
      id: master.recordName,
      name,
      size: res?.size ?? 0,
      modifiedTime:
        typeof assetDate === "number"
          ? new Date(assetDate).toISOString()
          : new Date().toISOString(),
      downloadUrl: res?.downloadURL,
      assetRecordName: asset?.recordName,
      changeTag: master.recordChangeTag,
    };
  });
}

async function upsertConnectedAccount(params: {
  userId: string;
  provider: ICloudProvider;
  appleId: string;
  displayName: string;
  session: ICloudStoredSession;
}) {
  return prisma.connectedAccount.upsert({
    where: {
      userId_provider_providerAccountId: {
        userId: params.userId,
        provider: params.provider,
        providerAccountId: params.appleId,
      },
    },
    create: {
      userId: params.userId,
      provider: params.provider,
      providerAccountId: params.appleId,
      email: params.appleId,
      displayName: params.displayName,
      accessTokenEncrypted: encryptText(JSON.stringify(params.session)),
      scopes: [],
      status: "connected",
      lastError: null,
    },
    update: {
      email: params.appleId,
      displayName: params.displayName,
      accessTokenEncrypted: encryptText(JSON.stringify(params.session)),
      status: "connected",
      lastError: null,
    },
  });
}

export type ICloudConnectResult =
  | { status: "connected"; account: ConnectedAccount }
  | { status: "mfa_required"; challengeId: string };

export async function startICloudConnect(params: {
  userId: string;
  appleId: string;
  password: string;
  provider: ICloudProvider;
  displayName?: string | null;
}): Promise<ICloudConnectResult> {
  const appleId = params.appleId.trim();
  const password = params.password.trim();
  const displayName = params.displayName?.trim() || appleId;
  const client = createICloudClient(appleId, password);
  await client.authenticate();

  if (client.status === "mfa_required") {
    const challengeId = stashPendingICloudAuth({
      client,
      userId: params.userId,
      provider: params.provider,
      appleId,
      password,
      displayName,
    });
    return { status: "mfa_required", challengeId };
  }

  const session = sessionFromClient(client, appleId, password);
  const account = await upsertConnectedAccount({
    userId: params.userId,
    provider: params.provider,
    appleId,
    displayName,
    session,
  });
  return { status: "connected", account };
}

export async function completeICloudMfa(params: {
  userId: string;
  challengeId: string;
  code: string;
}): Promise<ConnectedAccount> {
  const pending = takePendingICloudAuth(params.challengeId);
  if (!pending || pending.userId !== params.userId) {
    throw new Error("Verification expired. Start connecting again.");
  }
  await pending.client.provideMfaCode(params.code.trim());
  const session = sessionFromClient(
    pending.client,
    pending.appleId,
    pending.password,
  );
  return upsertConnectedAccount({
    userId: pending.userId,
    provider: pending.provider,
    appleId: pending.appleId,
    displayName: pending.displayName,
    session,
  });
}

export async function syncICloudQuota(accountId: string) {
  const account = await prisma.connectedAccount.findUniqueOrThrow({
    where: { id: accountId },
  });

  let totalBytes: bigint | null = null;
  let usedBytes = BigInt(0);
  let availableBytes: bigint | null = null;

  try {
    await withReadyClient(account, async (client) => {
      const usage = await client.getStorageUsage();
      if (typeof usage.totalStorageInBytes === "number") {
        totalBytes = BigInt(usage.totalStorageInBytes);
      }
      if (typeof usage.usedStorageInBytes === "number") {
        usedBytes = BigInt(usage.usedStorageInBytes);
      }
      if (totalBytes != null) availableBytes = totalBytes - usedBytes;
    });
  } catch {
    // Quota is best-effort.
  }

  return prisma.storageAccount.upsert({
    where: { connectedAccountId: accountId },
    create: {
      connectedAccountId: accountId,
      totalBytes,
      usedBytes,
      availableBytes,
      lastSyncedAt: new Date(),
    },
    update: {
      totalBytes,
      usedBytes,
      availableBytes,
      lastSyncedAt: new Date(),
    },
  });
}

async function browseICloudPhotosFolder(
  accountId: string,
  userId: string,
  parentId: string,
  searchQuery?: string,
): Promise<ProviderBrowseResult> {
  const account = await prisma.connectedAccount.findFirstOrThrow({
    where: {
      id: accountId,
      userId,
      provider: "icloud_photos",
      status: "connected",
    },
  });

  const session = readSession(account);
  return withReadyClient(account, async (client) => {
    const pcsChanged = await client.ensurePcsAccess("photos");
    if (pcsChanged) {
      await persistSession(
        account.id,
        sessionFromClient(client, session.appleId, session.password),
      );
    }
    await ensurePhotosZone(client);
    const q = searchQuery?.trim().toLowerCase();
    if (parentId === "root") {
      const albums = (await listPhotoAlbums(client)).filter(
        (name) => !HIDDEN_ALBUMS.has(name),
      );
      return {
        folders: albums
          .filter((name) => !q || name.toLowerCase().includes(q))
          .sort((a, b) => {
            if (a === "All Photos") return -1;
            if (b === "All Photos") return 1;
            return a.localeCompare(b);
          })
          .map((name) => ({
            id: name,
            name,
            modifiedTime: new Date().toISOString(),
          })),
        files: [],
        breadcrumbs: [{ id: "root", name: "iCloud Photos" }],
      };
    }

    const photos = await listAlbumPhotos(client, parentId);
    return {
      folders: [],
      files: photos
        .filter((p) => !q || p.name.toLowerCase().includes(q))
        .map((p) => ({
          id: p.id,
          name: p.name,
          mimeType: guessMime(p.name),
          sizeBytes: String(p.size),
          modifiedTime: p.modifiedTime,
          dbFileId: null as string | null,
        })),
      breadcrumbs: [
        { id: "root", name: "iCloud Photos" },
        { id: parentId, name: parentId },
      ],
    };
  });
}

async function browseICloudDriveFolder(
  accountId: string,
  userId: string,
  parentId: string,
  searchQuery?: string,
): Promise<ProviderBrowseResult> {
  const account = await prisma.connectedAccount.findFirstOrThrow({
    where: {
      id: accountId,
      userId,
      provider: "icloud_drive",
      status: "connected",
    },
  });

  return withReadyClient(account, async (client) => {
    const session = readSession(account);
    const pcsChanged = await client.ensurePcsAccess("iclouddrive");
    if (pcsChanged) {
      await persistSession(
        account.id,
        sessionFromClient(client, session.appleId, session.password),
      );
    }
    const driveUrl = client.webserviceUrl("drivews");
    const nodeId = driveParentId(parentId);
    const res = await fetch(`${driveUrl}/retrieveItemDetailsInFolders`, {
      method: "POST",
      headers: client.apiHeaders(),
      body: JSON.stringify([{ drivewsid: nodeId, partialData: false }]),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(
        errBody
          ? `iCloud Drive browse failed (${res.status}): ${errBody.slice(0, 200)}`
          : `iCloud Drive browse failed (${res.status}).`,
      );
    }
    let json = (await res.json()) as
      | Array<{
          name?: string;
          items?: Array<{
            type: string;
            drivewsid: string;
            docwsid?: string;
            etag: string;
            name: string;
            extension?: string;
            size?: number;
            dateModified?: string;
            dateCreated?: string;
          }>;
        }>
      | { errorCode?: number; errorReason?: string };
    if (!Array.isArray(json)) {
      if ("errorCode" in json) {
        throw new Error(json.errorReason || "iCloud Drive browse failed.");
      }
      json = [json as never];
    }
    const node = json[0];
    const q = searchQuery?.trim().toLowerCase();
    const items = node?.items ?? [];

    // APP_LIBRARY = app containers (Shortcuts, Pages, …) — browsable like folders.
    const folderTypes = new Set(["FOLDER", "APP_LIBRARY"]);

    return {
      folders: items
        .filter((item) => folderTypes.has(item.type))
        .filter((item) => !q || item.name.toLowerCase().includes(q))
        .map((item) => ({
          id: item.drivewsid,
          name: item.name || item.type,
          modifiedTime: item.dateModified
            ? new Date(item.dateModified).toISOString()
            : item.dateCreated
              ? new Date(item.dateCreated).toISOString()
              : new Date().toISOString(),
        })),
      files: items
        .filter((item) => item.type === "FILE")
        .map((item) => {
          const name = item.extension
            ? `${item.name}.${item.extension}`
            : item.name;
          return { item, name };
        })
        .filter(({ name }) => !q || name.toLowerCase().includes(q))
        .map(({ item, name }) => ({
          id: encodeDriveFileRef({
            drivewsid: item.drivewsid,
            docwsid: item.docwsid ?? "",
            etag: item.etag,
            size: item.size ?? 0,
            name,
          }),
          name,
          mimeType: guessMime(name),
          sizeBytes: String(item.size ?? 0),
          modifiedTime: item.dateModified
            ? new Date(item.dateModified).toISOString()
            : new Date().toISOString(),
          dbFileId: null as string | null,
        })),
      breadcrumbs: [
        { id: "root", name: "iCloud Drive" },
        ...(parentId !== "root"
          ? [{ id: parentId, name: node?.name || "Folder" }]
          : []),
      ],
    };
  });
}

export async function browseICloudFolder(
  provider: ICloudProvider,
  accountId: string,
  userId: string,
  parentId: string,
  searchQuery?: string,
): Promise<ProviderBrowseResult> {
  if (provider === "icloud_photos") {
    return browseICloudPhotosFolder(accountId, userId, parentId, searchQuery);
  }
  return browseICloudDriveFolder(accountId, userId, parentId, searchQuery);
}

export async function createICloudDriveFolder(
  account: ConnectedAccount,
  parentId: string,
  folderName: string,
): Promise<string> {
  assertProviderCapability(account.provider, "supportsUpload");
  if (account.provider !== "icloud_drive") {
    throw new Error("Folders can only be created on iCloud Drive.");
  }

  return withReadyClient(account, async (client) => {
    const driveUrl = client.webserviceUrl("drivews");
    const res = await fetch(`${driveUrl}/createFolders`, {
      method: "POST",
      headers: client.apiHeaders(),
      body: JSON.stringify({
        destinationDrivewsId: driveParentId(parentId),
        folders: [{ name: folderName, clientId: `ac-${Date.now()}` }],
      }),
    });
    if (!res.ok) throw new Error(`Create folder failed (${res.status}).`);
    const json = (await res.json()) as {
      folders?: Array<{ drivewsid?: string }>;
    };
    const id = json.folders?.[0]?.drivewsid;
    if (!id) throw new Error("Failed to create iCloud Drive folder.");
    return id;
  });
}

export async function getICloudFileMetadata(
  account: ConnectedAccount,
  fileId: string,
): Promise<{ name: string; mimeType: string; sizeBytes: bigint }> {
  assertProviderCapability(account.provider, "supportsDownload");

  if (account.provider === "icloud_drive") {
    const ref = decodeDriveFileRef(fileId);
    if (!ref) throw new Error("Invalid iCloud Drive file id.");
    return {
      name: ref.name,
      mimeType: guessMime(ref.name),
      sizeBytes: BigInt(ref.size ?? 0),
    };
  }

  return withReadyClient(account, async (client) => {
    const photos = await listAlbumPhotos(client, "All Photos");
    const item = photos.find((p) => p.id === fileId);
    if (!item) throw new Error("Photo not found in iCloud Photos.");
    return {
      name: item.name,
      mimeType: guessMime(item.name),
      sizeBytes: BigInt(item.size),
    };
  });
}

export async function downloadICloudFileStream(
  account: ConnectedAccount,
  fileId: string,
): Promise<{
  stream: Readable;
  mimeType: string;
  name: string;
  sizeBytes: bigint;
}> {
  assertProviderCapability(account.provider, "supportsDownload");

  if (account.provider === "icloud_drive") {
    const ref = decodeDriveFileRef(fileId);
    if (!ref) throw new Error("Invalid iCloud Drive file id.");
    return withReadyClient(account, async (client) => {
      const docsUrl = client.webserviceUrl("docws");
      const metaRes = await fetch(
        `${docsUrl}/ws/com.apple.CloudDocs/download/by_id?document_id=${encodeURIComponent(ref.docwsid)}`,
        { headers: client.apiHeaders() },
      );
      if (!metaRes.ok) {
        throw new Error(`Drive download meta failed (${metaRes.status}).`);
      }
      const meta = (await metaRes.json()) as {
        data_token?: { url?: string };
        package_token?: { url?: string };
        reason?: string;
      };
      const url = meta.data_token?.url ?? meta.package_token?.url;
      if (!url) throw new Error(meta.reason || "Drive download URL missing.");
      const fileRes = await fetch(url, { headers: client.apiHeaders() });
      if (!fileRes.ok || !fileRes.body) {
        throw new Error(`Drive download failed (${fileRes.status}).`);
      }
      return {
        stream: Readable.fromWeb(
          fileRes.body as import("stream/web").ReadableStream,
        ),
        mimeType: guessMime(ref.name),
        name: ref.name,
        sizeBytes: BigInt(ref.size ?? 0),
      };
    });
  }

  return withReadyClient(account, async (client) => {
    const photos = await listAlbumPhotos(client, "All Photos");
    const item = photos.find((p) => p.id === fileId);
    if (!item?.downloadUrl)
      throw new Error("Photo not found in iCloud Photos.");
    const res = await fetch(item.downloadUrl);
    if (!res.ok) throw new Error(`Photo download failed (${res.status}).`);
    const bytes = Buffer.from(await res.arrayBuffer());
    return {
      stream: Readable.from(bytes),
      mimeType: guessMime(item.name),
      name: item.name,
      sizeBytes: BigInt(bytes.length),
    };
  });
}

function webAuthToken(client: ICloudClient): string {
  for (const raw of client.cookies) {
    if (!raw.startsWith("X-APPLE-WEBAUTH-VALIDATE=")) continue;
    const value = raw.split(";")[0]?.slice("X-APPLE-WEBAUTH-VALIDATE=".length);
    const match = value ? /(?:^|[;:])t=([^:;]+)/.exec(value) : null;
    if (match?.[1]) return match[1];
    // Cookie value itself may be t=...
    const direct = value ? /t=([^:;]+)/.exec(decodeURIComponent(value)) : null;
    if (direct?.[1]) return direct[1];
  }
  throw new Error("iCloud Drive upload token missing. Reconnect the account.");
}

export async function uploadICloudFileFromStream(params: {
  account: ConnectedAccount;
  parentId: string;
  fileName: string;
  mimeType: string;
  body: unknown;
  sizeBytes?: bigint;
}): Promise<ProviderCopyResult> {
  assertProviderCapability(params.account.provider, "supportsUpload");
  const buffer = await streamToBuffer(params.body);
  const fileName = params.fileName.trim() || "untitled";

  if (params.account.provider === "icloud_drive") {
    return withReadyClient(params.account, async (client) => {
      const docsUrl = client.webserviceUrl("docws");
      const parentDocId = driveParentId(params.parentId).includes("::")
        ? driveParentId(params.parentId).split("::").pop()!
        : "root";
      const token = webAuthToken(client);
      const dsid = client.dsid();
      const contentType = params.mimeType || guessMime(fileName);

      const initUrl = new URL(`${docsUrl}/ws/com.apple.CloudDocs/upload/web`);
      if (dsid) initUrl.searchParams.set("dsid", dsid);
      initUrl.searchParams.set("token", token);

      const initRes = await fetch(initUrl, {
        method: "POST",
        headers: {
          ...client.apiHeaders(),
          "Content-Type": "text/plain",
        },
        body: JSON.stringify({
          filename: fileName,
          type: "FILE",
          content_type: contentType,
          size: buffer.length,
        }),
      });
      if (!initRes.ok) {
        throw new Error(`Drive upload init failed (${initRes.status}).`);
      }
      const initJson = (await initRes.json()) as Array<{
        document_id?: string;
        url?: string;
      }>;
      const documentId = initJson?.[0]?.document_id;
      const contentUrl = initJson?.[0]?.url;
      if (!documentId || !contentUrl) {
        throw new Error("iCloud Drive did not return an upload URL.");
      }

      const form = new FormData();
      form.append(
        fileName,
        new Blob([new Uint8Array(buffer)], { type: contentType }),
        fileName,
      );
      const putRes = await fetch(contentUrl, {
        method: "POST",
        headers: client.apiHeaders(),
        body: form,
      });
      if (!putRes.ok) {
        throw new Error(`Drive content upload failed (${putRes.status}).`);
      }
      const putJson = (await putRes.json()) as {
        singleFile?: {
          fileChecksum?: string;
          wrappingKey?: string;
          referenceChecksum?: string;
          size?: number;
          receipt?: string;
        };
      };
      const sf = putJson.singleFile;
      if (!sf?.fileChecksum || !sf.wrappingKey || !sf.referenceChecksum) {
        throw new Error("iCloud Drive upload response incomplete.");
      }

      const updateUrl = new URL(
        `${docsUrl}/ws/com.apple.CloudDocs/update/documents`,
      );
      if (dsid) updateUrl.searchParams.set("dsid", dsid);
      const updateRes = await fetch(updateUrl, {
        method: "POST",
        headers: {
          ...client.apiHeaders(),
          "Content-Type": "text/plain",
        },
        body: JSON.stringify({
          data: {
            signature: sf.fileChecksum,
            wrapping_key: sf.wrappingKey,
            reference_signature: sf.referenceChecksum,
            size: sf.size ?? buffer.length,
            ...(sf.receipt ? { receipt: sf.receipt } : {}),
          },
          command: "add_file",
          create_short_guid: true,
          document_id: documentId,
          path: { starting_document_id: parentDocId, path: fileName },
          allow_conflict: true,
          file_flags: {
            is_writable: true,
            is_executable: false,
            is_hidden: false,
          },
          mtime: Date.now(),
          btime: Date.now(),
        }),
      });
      if (!updateRes.ok) {
        throw new Error(`Drive finalize failed (${updateRes.status}).`);
      }

      return {
        destProviderFileId: encodeDriveFileRef({
          drivewsid: `FILE::com.apple.CloudDocs::${documentId}`,
          docwsid: documentId,
          etag: "upload",
          size: buffer.length,
          name: fileName,
        }),
        name: fileName,
        mimeType: contentType,
        sizeBytes: BigInt(buffer.length),
      };
    });
  }

  return withReadyClient(params.account, async (client) => {
    const uploadBase = client.accountInfo?.webservices?.photosupload?.url;
    if (!uploadBase) {
      throw new Error(
        "iCloud Photos uploads are not available for this Apple account.",
      );
    }
    const url = new URL(`${uploadBase.replace(/\/$/, "")}/upload`);
    url.searchParams.set("filename", fileName);
    const dsid = client.dsid();
    if (dsid) url.searchParams.set("dsid", dsid);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        ...client.apiHeaders(),
        "Content-Type": params.mimeType || guessMime(fileName),
      },
      body: new Uint8Array(buffer),
    });
    if (!res.ok) {
      throw new Error(`iCloud Photos upload failed (${res.status}).`);
    }
    const payload = (await res.json().catch(() => null)) as {
      records?: Array<{ recordName?: string; recordType?: string }>;
    } | null;
    const master = payload?.records?.find((r) => r.recordType === "CPLMaster");

    return {
      destProviderFileId: master?.recordName ?? `upload-${Date.now()}`,
      name: fileName,
      mimeType: params.mimeType || guessMime(fileName),
      sizeBytes: BigInt(buffer.length),
    };
  });
}

export async function deleteICloudFile(
  account: ConnectedAccount,
  fileId: string,
): Promise<void> {
  assertProviderCapability(account.provider, "supportsDelete");

  if (account.provider === "icloud_drive") {
    const ref = decodeDriveFileRef(fileId);
    if (!ref) throw new Error("Invalid iCloud Drive file id.");
    await withReadyClient(account, async (client) => {
      const driveUrl = client.webserviceUrl("drivews");
      const res = await fetch(`${driveUrl}/moveItemsToTrash`, {
        method: "POST",
        headers: client.apiHeaders(),
        body: JSON.stringify({
          items: [
            {
              drivewsid: ref.drivewsid,
              etag: ref.etag,
              clientId: `ac-${Date.now()}`,
            },
          ],
        }),
      });
      if (!res.ok) throw new Error(`Drive delete failed (${res.status}).`);
    });
    return;
  }

  await withReadyClient(account, async (client) => {
    const photos = await listAlbumPhotos(client, "All Photos");
    const item = photos.find((p) => p.id === fileId);
    if (!item?.assetRecordName || !item.changeTag) {
      throw new Error("Photo not found in iCloud Photos.");
    }
    await photosPost(client, "/records/modify", {
      operations: [
        {
          operationType: "update",
          record: {
            recordName: item.assetRecordName,
            recordType: "CPLAsset",
            recordChangeTag: item.changeTag,
            fields: { isDeleted: { value: 1 } },
          },
        },
      ],
      zoneID: { zoneName: "PrimarySync" },
      atomic: true,
    });
  });
}
