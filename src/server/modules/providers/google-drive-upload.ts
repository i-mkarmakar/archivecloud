import "server-only";

import type { Readable } from "node:stream";
import { google } from "googleapis";
import type { ConnectedAccount } from "@/generated/prisma/client";
import { getAuthedGoogleClient } from "@/server/modules/google/google.service";

/**
 * Single seam for Google Drive upload I/O used by the uploads handler.
 * Commit A: pure move of googleapis/fetch logic out of the handler.
 */
export async function uploadGoogleDriveMediaFile(params: {
  account: ConnectedAccount;
  fileName: string;
  mimeType: string;
  parentId: string;
  body: Readable;
}): Promise<{ id: string; name: string; mimeType: string }> {
  const auth = await getAuthedGoogleClient(params.account);
  const drive = google.drive({ version: "v3", auth });
  const uploaded = await drive.files.create({
    requestBody: { name: params.fileName, parents: [params.parentId] },
    media: { mimeType: params.mimeType, body: params.body },
    fields: "id,name,mimeType,size",
  });
  return {
    id: uploaded.data.id ?? "",
    name: uploaded.data.name ?? params.fileName,
    mimeType: uploaded.data.mimeType ?? params.mimeType,
  };
}

export async function initGoogleDriveResumableUpload(params: {
  account: ConnectedAccount;
  fileName: string;
  mimeType: string;
  sizeBytes: bigint;
  parentId: string;
}): Promise<string> {
  const auth = await getAuthedGoogleClient(params.account);
  const headers = new Headers();
  const token = await auth.getAccessToken();
  headers.set("Authorization", `Bearer ${token.token}`);
  headers.set("Content-Type", "application/json");
  headers.set("X-Upload-Content-Type", params.mimeType);
  headers.set("X-Upload-Content-Length", params.sizeBytes.toString());

  const initRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: params.fileName,
        parents: [params.parentId],
      }),
    },
  );

  if (!initRes.ok) {
    const errText = await initRes.text();
    throw new Error(`Google API Init Error: ${errText}`);
  }

  const sessionUri = initRes.headers.get("location");
  if (!sessionUri)
    throw new Error("Google API did not return Location header.");
  return sessionUri;
}

export async function queryGoogleDriveResumableStatus(params: {
  account: ConnectedAccount;
  sessionUri: string;
  sizeBytes: bigint;
}): Promise<Response> {
  const auth = await getAuthedGoogleClient(params.account);
  const token = await auth.getAccessToken();

  const queryHeaders = new Headers();
  queryHeaders.set("Authorization", `Bearer ${token.token}`);
  queryHeaders.set("Content-Range", `bytes */${params.sizeBytes}`);

  return fetch(params.sessionUri, {
    method: "PUT",
    headers: queryHeaders,
  });
}

export async function putGoogleDriveResumableChunk(params: {
  account: ConnectedAccount;
  sessionUri: string;
  contentRange: string;
  contentLength: string;
  body: ReadableStream<Uint8Array> | null;
}): Promise<Response> {
  const auth = await getAuthedGoogleClient(params.account);
  const token = await auth.getAccessToken();

  const putHeaders = new Headers();
  putHeaders.set("Authorization", `Bearer ${token.token}`);
  putHeaders.set("Content-Range", params.contentRange);
  putHeaders.set("Content-Length", params.contentLength);

  return fetch(params.sessionUri, {
    method: "PUT",
    headers: putHeaders,
    body: params.body,
    duplex: "half",
  } as RequestInit);
}
