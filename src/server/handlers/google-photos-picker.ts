import { z } from "zod";
import { prisma } from "@/server/config/prisma";
import { requireAuthUser } from "@/server/http/auth";
import { errorJson, json } from "@/server/http/responses";
import {
  accountHasPhotosPickerScope,
  createPickerSession,
  deletePickerSession,
  GooglePhotosPickerError,
  getOwnedGooglePhotosAccount,
  getPickerSession,
  listPickedMediaItems,
  normalizePickedMediaItem,
} from "@/server/modules/providers/google/google-photos-picker.service";
import { isSupportedProvider } from "@/server/modules/providers/types";
import { stashPhotosPickerPayload } from "@/server/modules/transfers/photos-picker-job-payload";
import { enqueueTransferJob } from "@/server/modules/transfers/process-job";
import { assertTransferCapacity } from "@/server/modules/transfers/usage";
import { createAuditLog } from "@/server/utils/audit";

function pickerErrorResponse(error: unknown) {
  if (error instanceof GooglePhotosPickerError) {
    return errorJson(error.code, error.message, error.status);
  }
  console.error("Google Photos Picker handler failed:", error);
  return errorJson(
    "PHOTOS_PICKER_FAILED",
    error instanceof Error
      ? error.message
      : "Google Photos Picker request failed.",
    500,
  );
}

function parsePollIntervalSeconds(value: string | undefined) {
  if (!value?.trim()) return 5;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)s?$/i);
  if (!match) return 5;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) return 5;
  return Math.min(Math.max(seconds, 1), 30);
}

/** Prefer path/query over params — nested [sessionId] routes can 404 on Windows/Turbopack. */
function resolvePhotosPickerIds(
  request: Request,
  params?: Record<string, string>,
) {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const accountId =
    (parts[0] === "connected-accounts" ? parts[1] : undefined) ||
    params?.id ||
    "";

  let sessionId = url.searchParams.get("sessionId") || params?.sessionId || "";
  if (!sessionId) {
    const sessionIdx = parts.indexOf("session");
    if (sessionIdx >= 0 && parts[sessionIdx + 1]) {
      sessionId = parts[sessionIdx + 1];
    } else {
      const mediaIdx = parts.indexOf("media-items");
      if (mediaIdx >= 0 && parts[mediaIdx + 1]) {
        sessionId = parts[mediaIdx + 1];
      }
    }
  }

  try {
    sessionId = decodeURIComponent(sessionId);
  } catch {
    // keep raw
  }
  sessionId = sessionId.replace(/^sessions\//i, "").trim();

  return { accountId, sessionId };
}

export async function createGooglePhotosPickerSessionHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const { accountId } = resolvePhotosPickerIds(request, params);
  if (!accountId) {
    return errorJson("VALIDATION_ERROR", "Account id required.", 400);
  }

  try {
    const body = z
      .object({
        maxItemCount: z.coerce.number().int().min(1).max(2000).optional(),
      })
      .parse(await request.json().catch(() => ({})));

    const account = await getOwnedGooglePhotosAccount(accountId, user.id);
    if (!accountHasPhotosPickerScope(account)) {
      return errorJson(
        "PHOTOS_PICKER_SCOPE_MISSING",
        "Google Photos permission needs to be updated. Please reconnect your Google Photos account and allow Google Photos access.",
        403,
      );
    }

    const session = await createPickerSession(account, {
      maxItemCount: body.maxItemCount,
    });

    const pickerUri = session.pickerUri.endsWith("/autoclose")
      ? session.pickerUri
      : `${session.pickerUri.replace(/\/$/, "")}/autoclose`;

    return json(
      {
        session: {
          id: session.id,
          pickerUri,
          expireTime: session.expireTime ?? null,
          mediaItemsSet: Boolean(session.mediaItemsSet),
          pollingConfig: {
            pollIntervalSeconds: parsePollIntervalSeconds(
              session.pollingConfig?.pollInterval,
            ),
            pollInterval: session.pollingConfig?.pollInterval ?? null,
            timeoutIn: session.pollingConfig?.timeoutIn ?? null,
          },
        },
      },
      201,
    );
  } catch (error) {
    return pickerErrorResponse(error);
  }
}

export async function getGooglePhotosPickerSessionHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const { accountId, sessionId } = resolvePhotosPickerIds(request, params);
  if (!accountId || !sessionId) {
    return errorJson(
      "VALIDATION_ERROR",
      "Account id and session id required.",
      400,
    );
  }

  try {
    const account = await getOwnedGooglePhotosAccount(accountId, user.id);
    const session = await getPickerSession(account, sessionId);
    return json({
      session: {
        id: session.id,
        pickerUri: session.pickerUri,
        expireTime: session.expireTime ?? null,
        mediaItemsSet: Boolean(session.mediaItemsSet),
        pollingConfig: {
          pollIntervalSeconds: parsePollIntervalSeconds(
            session.pollingConfig?.pollInterval,
          ),
          pollInterval: session.pollingConfig?.pollInterval ?? null,
          timeoutIn: session.pollingConfig?.timeoutIn ?? null,
        },
      },
    });
  } catch (error) {
    return pickerErrorResponse(error);
  }
}

export async function listGooglePhotosPickerMediaItemsHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const { accountId, sessionId } = resolvePhotosPickerIds(request, params);
  if (!accountId || !sessionId) {
    return errorJson(
      "VALIDATION_ERROR",
      "Account id and session id required.",
      400,
    );
  }

  try {
    const account = await getOwnedGooglePhotosAccount(accountId, user.id);
    const session = await getPickerSession(account, sessionId);
    if (!session.mediaItemsSet) {
      return json({
        mediaItemsSet: false,
        mediaItems: [],
        count: 0,
      });
    }

    const items = await listPickedMediaItems(account, sessionId);
    const mediaItems = items.map(normalizePickedMediaItem);
    return json({
      mediaItemsSet: true,
      mediaItems,
      count: mediaItems.length,
    });
  } catch (error) {
    return pickerErrorResponse(error);
  }
}

export async function deleteGooglePhotosPickerSessionHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const { accountId, sessionId } = resolvePhotosPickerIds(request, params);
  if (!accountId || !sessionId) {
    return errorJson(
      "VALIDATION_ERROR",
      "Account id and session id required.",
      400,
    );
  }

  try {
    const account = await getOwnedGooglePhotosAccount(accountId, user.id);
    await deletePickerSession(account, sessionId);
    return json({ status: "ok" });
  } catch (error) {
    return pickerErrorResponse(error);
  }
}

export async function importGooglePhotosPickerMediaHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const accountId = params?.id;
  if (!accountId) {
    return errorJson("VALIDATION_ERROR", "Account id required.", 400);
  }

  try {
    const body = z
      .object({
        sessionId: z.string().min(1),
        destAccountId: z.string().min(1),
        destParentId: z.string().min(1).optional().nullable(),
        mediaItemIds: z.array(z.string().min(1)).optional(),
      })
      .parse(await request.json());

    const sourceAccount = await getOwnedGooglePhotosAccount(accountId, user.id);

    // ACH-style: caller picks destination cloud (+ folder). No silent fallback.
    const destAccount = await prisma.connectedAccount.findFirst({
      where: {
        id: body.destAccountId,
        userId: user.id,
        status: "connected",
      },
    });
    if (!destAccount) {
      return errorJson(
        "ACCOUNT_NOT_FOUND",
        "Destination account not found.",
        404,
      );
    }
    if (!isSupportedProvider(destAccount.provider)) {
      return errorJson(
        "UNSUPPORTED_PROVIDER",
        "Destination provider is not supported.",
        400,
      );
    }
    if (destAccount.provider === "google_photos") {
      return errorJson(
        "UNSUPPORTED_DESTINATION",
        "Choose a destination other than Google Photos.",
        400,
      );
    }

    const session = await getPickerSession(sourceAccount, body.sessionId);
    if (!session.mediaItemsSet) {
      return errorJson(
        "PHOTOS_PICKER_NOT_READY",
        "No media has been selected yet. Finish selecting in Google Photos, then try again.",
        409,
      );
    }

    const picked = await listPickedMediaItems(sourceAccount, body.sessionId);
    const selectedIds = body.mediaItemIds?.length
      ? new Set(body.mediaItemIds)
      : null;
    const items = selectedIds
      ? picked.filter((item) => selectedIds.has(item.id))
      : picked;

    if (items.length === 0) {
      return json({
        imported: 0,
        queued: 0,
        failed: 0,
        jobs: [],
        message: "No media selected.",
      });
    }

    try {
      await assertTransferCapacity(user.id, BigInt(items.length));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Transfer limit exceeded.";
      return errorJson("TRANSFER_LIMIT_EXCEEDED", message, 402);
    }

    const jobs: Array<{
      id: string;
      fileName: string;
      status: string;
      errorMessage: string | null;
      destProviderFileId: string | null;
      fileId: string | null;
    }> = [];

    for (const item of items) {
      const normalized = normalizePickedMediaItem(item);
      const providerFileId =
        item.id.length <= 191 ? item.id : item.id.slice(0, 191);

      const job = await prisma.transferJob.create({
        data: {
          userId: user.id,
          type: "copy",
          status: "queued",
          sourceAccountId: sourceAccount.id,
          destAccountId: destAccount.id,
          sourceProviderFileId: providerFileId,
          destParentId: body.destParentId ?? null,
          fileName: normalized.filename,
          mimeType: normalized.mimeType,
          sizeBytes: 0n,
        },
      });

      stashPhotosPickerPayload(job.id, item);
      enqueueTransferJob(job.id);

      await createAuditLog(
        user.id,
        "TRANSFER_COPY_QUEUED",
        "transfer_job",
        job.id,
        {
          sourceAccountId: sourceAccount.id,
          destAccountId: destAccount.id,
          fileName: normalized.filename,
          via: "google_photos_picker",
        },
      );

      jobs.push({
        id: job.id,
        fileName: normalized.filename,
        status: "queued",
        errorMessage: null,
        destProviderFileId: null,
        fileId: null,
      });
    }

    try {
      await deletePickerSession(sourceAccount, body.sessionId);
    } catch {
      // Session cleanup is best-effort; download URLs were stashed on each job.
    }

    return json({
      imported: 0,
      queued: jobs.length,
      failed: 0,
      count: items.length,
      jobs,
    });
  } catch (error) {
    return pickerErrorResponse(error);
  }
}
