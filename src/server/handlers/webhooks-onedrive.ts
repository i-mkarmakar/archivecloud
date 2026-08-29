import { prisma } from "@/server/config/prisma";
import { json } from "@/server/http/responses";
import { scheduleFolderSyncsForAccount } from "@/server/modules/webhooks/trigger-account-syncs";

export async function oneDriveWebhookHandler(request: Request) {
  const url = new URL(request.url);
  const validationToken = url.searchParams.get("validationToken");
  if (validationToken) {
    return new Response(validationToken, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  let body: {
    value?: Array<{
      subscriptionId?: string;
      clientState?: string;
      changeType?: string;
      resource?: string;
    }>;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, reason: "invalid_json" }, 400);
  }

  const notifications = body.value ?? [];
  const matchedAccountIds = new Set<string>();

  for (const note of notifications) {
    if (!note.subscriptionId) continue;

    const channel = await prisma.providerWebhookChannel.findUnique({
      where: {
        provider_channelId: {
          provider: "onedrive",
          channelId: note.subscriptionId,
        },
      },
    });
    if (!channel || channel.status !== "active") continue;
    if (note.clientState && note.clientState !== channel.channelToken) {
      continue;
    }

    await prisma.providerWebhookChannel.update({
      where: { id: channel.id },
      data: { lastNotifiedAt: new Date(), lastError: null },
    });

    matchedAccountIds.add(channel.connectedAccountId);
  }

  for (const accountId of matchedAccountIds) {
    scheduleFolderSyncsForAccount(accountId, "onedrive_webhook");
  }

  return json({ ok: true, matched: matchedAccountIds.size }, 202);
}
