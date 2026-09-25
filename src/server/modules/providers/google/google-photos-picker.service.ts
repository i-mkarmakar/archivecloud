import "server-only";

import { Readable } from "node:stream";
import type { ConnectedAccount } from "@/generated/prisma/client";
import { prisma } from "@/server/config/prisma";
import { normalizeHeaders } from "@/server/modules/providers/google/drive-stream";
import { getAuthedGoogleClient } from "@/server/modules/providers/google/google.service";

const PICKER_API = "https://photospicker.googleapis.com/v1";

export const GOOGLE_PHOTOS_PICKER_SCOPE =
  "https://www.googleapis.com/auth/photospicker.mediaitems.readonly";

export type PickerPollingConfig = {
  pollInterval?: string;
  timeoutIn?: string;
};

export type PickerPickingConfig = {
  maxItemCount?: string;
};

export type PickerSession = {
  id: string;
  pickerUri: string;
  pollingConfig?: PickerPollingConfig;
  expireTime?: string;
  pickingConfig?: PickerPickingConfig;
  mediaItemsSet?: boolean;
};

export type PickedMediaFile = {
  baseUrl?: string;
  mimeType?: string;
  filename?: string;
  mediaFileMetadata?: {
    width?: number;
    height?: number;
    cameraMake?: string;
    cameraModel?: string;
    photoMetadata?: Record<string, unknown>;
    videoMetadata?: {
      fps?: number;
      processingStatus?: string;
    };
  };
};

export type PickedMediaItem = {
  id: string;
  createTime?: string;
  type?: "TYPE_UNSPECIFIED" | "PHOTO" | "VIDEO" | string;
  mediaFile?: PickedMediaFile;
};

export type NormalizedPickedMediaItem = {
  id: string;
  type: string;
  createTime: string | null;
  filename: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  videoProcessingStatus: string | null;
};

export class GooglePhotosPickerError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "GooglePhotosPickerError";
    this.code = code;
    this.status = status;
  }
}

function accountScopes(account: ConnectedAccount): string[] {
  if (!Array.isArray(account.scopes)) return [];
  return account.scopes.filter(
    (scope): scope is string => typeof scope === "string",
  );
}

export function accountHasPhotosPickerScope(
  account: ConnectedAccount,
): boolean {
  return accountScopes(account).includes(GOOGLE_PHOTOS_PICKER_SCOPE);
}

export function assertPhotosPickerScope(account: ConnectedAccount) {
  if (!accountHasPhotosPickerScope(account)) {
    throw new GooglePhotosPickerError(
      "PHOTOS_PICKER_SCOPE_MISSING",
      "Google Photos permission needs to be updated. Please reconnect your Google Photos account and allow Google Photos access.",
      403,
    );
  }
}

function isInsufficientScopeResponse(status: number, bodyText: string) {
  if (status !== 403) return false;
  return /insufficient authentication scopes|ACCESS_TOKEN_SCOPE_INSUFFICIENT|PERMISSION_DENIED/i.test(
    bodyText,
  );
}

function isSessionExpiredResponse(status: number, bodyText: string) {
  if (status === 404) return true;
  return /EXPIRED|expired|NOT_FOUND/i.test(bodyText);
}

async function pickerFetch(
  account: ConnectedAccount,
  path: string,
  init?: RequestInit,
) {
  assertPhotosPickerScope(account);
  const auth = await getAuthedGoogleClient(account);
  const authHeaders = normalizeHeaders(await auth.getRequestHeaders());
  const response = await fetch(`${PICKER_API}${path}`, {
    ...init,
    headers: {
      ...authHeaders,
      ...(init?.headers ?? {}),
    },
  });
  return response;
}

async function pickerJson<T>(
  account: ConnectedAccount,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await pickerFetch(account, path, init);
  const bodyText = await response.text();
  if (!response.ok) {
    if (isInsufficientScopeResponse(response.status, bodyText)) {
      throw new GooglePhotosPickerError(
        "PHOTOS_PICKER_SCOPE_MISSING",
        "Google Photos permission needs to be updated. Please reconnect your Google Photos account and allow Google Photos access.",
        403,
      );
    }
    if (isSessionExpiredResponse(response.status, bodyText)) {
      throw new GooglePhotosPickerError(
        "PHOTOS_PICKER_SESSION_EXPIRED",
        "Your Google Photos selection session expired. Please try again.",
        410,
      );
    }
    console.error(
      `Google Photos Picker API ${path} failed (${response.status}):`,
      bodyText.slice(0, 500),
    );
    throw new GooglePhotosPickerError(
      "PHOTOS_PICKER_API_FAILED",
      "Google Photos Picker request failed. Please try again.",
      502,
    );
  }
  if (response.status === 204 || !bodyText) return undefined as T;
  return JSON.parse(bodyText) as T;
}

export async function getOwnedGooglePhotosAccount(
  accountId: string,
  userId: string,
) {
  const account = await prisma.connectedAccount.findFirst({
    where: {
      id: accountId,
      userId,
      provider: "google_photos",
      status: "connected",
    },
  });
  if (!account) {
    throw new GooglePhotosPickerError(
      "ACCOUNT_NOT_FOUND",
      "Connected Google Photos account not found.",
      404,
    );
  }
  return account;
}

export async function createPickerSession(
  account: ConnectedAccount,
  options?: { maxItemCount?: number },
): Promise<PickerSession> {
  const maxItemCount = options?.maxItemCount ?? 50;
  const session = await pickerJson<PickerSession>(account, "/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pickingConfig: {
        maxItemCount: String(maxItemCount),
      },
    }),
  });
  if (!session?.id || !session.pickerUri) {
    throw new GooglePhotosPickerError(
      "PHOTOS_PICKER_API_FAILED",
      "Google Photos Picker did not return a valid session.",
      502,
    );
  }
  return session;
}

export async function getPickerSession(
  account: ConnectedAccount,
  sessionId: string,
): Promise<PickerSession> {
  const id = sessionId.trim();
  if (!id) {
    throw new GooglePhotosPickerError(
      "VALIDATION_ERROR",
      "Picker session id is required.",
      400,
    );
  }
  return pickerJson<PickerSession>(
    account,
    `/sessions/${encodeURIComponent(id)}`,
  );
}

export async function deletePickerSession(
  account: ConnectedAccount,
  sessionId: string,
): Promise<void> {
  const id = sessionId.trim();
  if (!id) {
    throw new GooglePhotosPickerError(
      "VALIDATION_ERROR",
      "Picker session id is required.",
      400,
    );
  }
  await pickerJson<void>(account, `/sessions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

function defaultFilename(item: PickedMediaItem) {
  const fromApi = item.mediaFile?.filename?.trim();
  if (fromApi) return fromApi;
  const isVideo = item.type === "VIDEO";
  const suffix = isVideo ? "mp4" : "jpg";
  if (item.createTime) {
    return `photo-${item.createTime.replace(/[:.]/g, "-")}.${suffix}`;
  }
  return `media-${item.id}.${suffix}`;
}

function defaultMimeType(item: PickedMediaItem) {
  if (item.mediaFile?.mimeType) return item.mediaFile.mimeType;
  if (item.type === "VIDEO") return "video/mp4";
  if (item.type === "PHOTO") return "image/jpeg";
  return "application/octet-stream";
}

export function normalizePickedMediaItem(
  item: PickedMediaItem,
): NormalizedPickedMediaItem {
  return {
    id: item.id,
    type: item.type ?? "TYPE_UNSPECIFIED",
    createTime: item.createTime ?? null,
    filename: defaultFilename(item),
    mimeType: defaultMimeType(item),
    width: item.mediaFile?.mediaFileMetadata?.width ?? null,
    height: item.mediaFile?.mediaFileMetadata?.height ?? null,
    videoProcessingStatus:
      item.mediaFile?.mediaFileMetadata?.videoMetadata?.processingStatus ??
      null,
  };
}

export async function listPickedMediaItems(
  account: ConnectedAccount,
  sessionId: string,
): Promise<PickedMediaItem[]> {
  const id = sessionId.trim();
  if (!id) {
    throw new GooglePhotosPickerError(
      "VALIDATION_ERROR",
      "Picker session id is required.",
      400,
    );
  }

  const items: PickedMediaItem[] = [];
  let pageToken: string | undefined;
  do {
    const query = new URLSearchParams({
      sessionId: id,
      pageSize: "100",
    });
    if (pageToken) query.set("pageToken", pageToken);
    const response = await pickerJson<{
      mediaItems?: PickedMediaItem[];
      nextPageToken?: string;
    }>(account, `/mediaItems?${query.toString()}`);
    items.push(...(response.mediaItems ?? []));
    pageToken = response.nextPageToken;
  } while (pageToken);

  return items;
}

function downloadParamForItem(item: PickedMediaItem) {
  if (item.type === "VIDEO") return "dv";
  return "d";
}

export async function downloadPickedMediaStream(
  account: ConnectedAccount,
  item: PickedMediaItem,
): Promise<{
  stream: Readable;
  mimeType: string;
  name: string;
  sizeBytes: bigint;
}> {
  const baseUrl = item.mediaFile?.baseUrl?.trim();
  if (!baseUrl) {
    throw new GooglePhotosPickerError(
      "PHOTOS_PICKER_MEDIA_UNAVAILABLE",
      "A selected Google Photos item is missing a download URL.",
      502,
    );
  }

  if (item.type === "VIDEO") {
    const status =
      item.mediaFile?.mediaFileMetadata?.videoMetadata?.processingStatus;
    if (status && status !== "READY") {
      throw new GooglePhotosPickerError(
        "PHOTOS_PICKER_VIDEO_NOT_READY",
        `"${defaultFilename(item)}" is still processing in Google Photos. Try again shortly.`,
        409,
      );
    }
  }

  const auth = await getAuthedGoogleClient(account);
  const headers = normalizeHeaders(await auth.getRequestHeaders());
  const downloadUrl = `${baseUrl}=${downloadParamForItem(item)}`;
  const response = await fetch(downloadUrl, { headers });
  if (!response.ok || !response.body) {
    const bodyText = await response.text().catch(() => "");
    console.error(
      `Google Photos Picker download failed (${response.status}):`,
      bodyText.slice(0, 300),
    );
    throw new GooglePhotosPickerError(
      "PHOTOS_PICKER_DOWNLOAD_FAILED",
      `Failed to download "${defaultFilename(item)}" from Google Photos.`,
      502,
    );
  }

  return {
    stream: Readable.fromWeb(
      response.body as import("stream/web").ReadableStream,
    ),
    mimeType: defaultMimeType(item),
    name: defaultFilename(item),
    sizeBytes: 0n,
  };
}
