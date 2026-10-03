import { prisma } from "@/server/config/prisma";
import { json } from "@/server/http/responses";
import { scheduleCatalogIncrementalSync } from "@/server/modules/indexing/trigger-catalog-sync";
import { scheduleFolderSyncsForAccount } from "@/server/modules/webhooks/trigger-account-syncs";

export async function googleDriveWebhookHandler(request: Request) {
  const channelId = request.headers.get("x-goog-channel-id");
  const resourceState = request.headers.get("x-goog-resource-state");
  const channelToken = request.headers.get("x-goog-channel-token");
  const resourceId = request.headers.get("x-goog-resource-id");

  if (!channelId) {
    return json({ ok: false, reason: "missing_channel" }, 400);
  }

  const channel = await prisma.providerWebhookChannel.findUnique({
    where: {
      provider_channelId: {
        provider: "google_drive",
        channelId,
      },
    },
  });

  const channelAlt =
    channel ??
    (await prisma.providerWebhookChannel.findFirst({
      where: {
        channelId,
        provider: { in: ["google_drive", "google_shared_drive"] },
        status: "active",
      },
    }));

  if (!channelAlt) {
    return json({ ok: true, ignored: true });
  }

  // Fail closed: channel token is required proof (registered with Google watches).
  if (!channelToken || channelToken !== channelAlt.channelToken) {
    return json({ ok: false, reason: "invalid_token" }, 403);
  }

  // When a resourceId was stored at watch create, require a matching header.
  if (channelAlt.resourceId) {
    if (!resourceId || resourceId !== channelAlt.resourceId) {
      return json({ ok: false, reason: "resource_mismatch" }, 403);
    }
  }

  await prisma.providerWebhookChannel.update({
    where: { id: channelAlt.id },
    data: { lastNotifiedAt: new Date(), lastError: null },
  });

  if (resourceState === "sync") {
    return json({ ok: true, sync: true });
  }

  const reason = `google_drive_${resourceState ?? "change"}`;
  scheduleFolderSyncsForAccount(channelAlt.connectedAccountId, reason);
  // Catalog incremental sync is separate from FolderSync.
  scheduleCatalogIncrementalSync(channelAlt.connectedAccountId, reason);

  return json({ ok: true });
}
