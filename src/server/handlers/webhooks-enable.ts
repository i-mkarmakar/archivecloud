import { z } from "zod";
import { env } from "@/server/config/env";
import { prisma } from "@/server/config/prisma";
import { requireAuthUser } from "@/server/http/auth";
import { errorJson, json } from "@/server/http/responses";
import { requirePlanFeature } from "@/server/modules/billing/plan-gate";
import { ensureDropboxWebhookCursor } from "@/server/modules/webhooks/dropbox-notify";
import {
  ensureGoogleDriveWatch,
  isGoogleWatchableProvider,
  resolveWebhookBaseUrl,
} from "@/server/modules/webhooks/google-drive-watch";
import { ensureOneDriveSubscription } from "@/server/modules/webhooks/onedrive-subscription";

const accountIdSchema = z.string().min(1);

export async function enableAccountWebhooksHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  const gated = await requirePlanFeature(
    user.id,
    "realtimeSync",
    "Automatic real-time sync is included with Thunder ($9 lifetime).",
  );
  if (gated) return gated;

  const accountIdParsed = accountIdSchema.safeParse(params?.id);
  if (!accountIdParsed.success) {
    return errorJson("VALIDATION_ERROR", "Account id required.", 400);
  }
  const accountId = accountIdParsed.data;

  const account = await prisma.connectedAccount.findFirst({
    where: { id: accountId, userId: user.id, status: "connected" },
  });
  if (!account) {
    return errorJson("NOT_FOUND", "Connected account not found.", 404);
  }

  if (isGoogleWatchableProvider(account.provider)) {
    if (!resolveWebhookBaseUrl()) {
      return errorJson(
        "WEBHOOK_HTTPS_REQUIRED",
        "Set WEBHOOK_BASE_URL (or APP_URL) to a public HTTPS URL to register Google Drive watches.",
        400,
      );
    }
    const result = await ensureGoogleDriveWatch(account);
    return json({
      provider: account.provider,
      ...result,
      endpoint: "/webhooks/google-drive",
    });
  }

  if (account.provider === "dropbox") {
    await ensureDropboxWebhookCursor(account.id, account.providerAccountId);
    const base = (resolveWebhookBaseUrl() ?? env.APP_URL).replace(/\/$/, "");
    return json({
      provider: "dropbox",
      registered: true,
      reason: "cursor_ready",
      endpoint: "/webhooks/dropbox",
      configureInDropboxAppConsole: `${base}/webhooks/dropbox`,
    });
  }

  if (account.provider === "onedrive") {
    if (!resolveWebhookBaseUrl()) {
      return errorJson(
        "WEBHOOK_HTTPS_REQUIRED",
        "Set WEBHOOK_BASE_URL (or APP_URL) to a public HTTPS URL to register OneDrive subscriptions.",
        400,
      );
    }
    const result = await ensureOneDriveSubscription(account);
    return json({
      provider: "onedrive",
      ...result,
      endpoint: "/webhooks/onedrive",
    });
  }

  return errorJson(
    "UNSUPPORTED_PROVIDER",
    "Change webhooks are supported for Google Drive, Shared Drive, OneDrive, and Dropbox.",
    400,
  );
}
