import { z } from "zod";
import { prisma } from "@/server/config/prisma";
import { json } from "@/server/http/responses";
import { scheduleFolderSyncsForAccount } from "@/server/modules/webhooks/trigger-account-syncs";

const oneDriveNotificationSchema = z.object({
  value: z
    .array(
      z.object({
        subscriptionId: z.string().optional(),
        clientState: z.string().optional(),
        changeType: z.string().optional(),
        resource: z.string().optional(),
      }),
    )
    .optional(),
});

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

  let jsonBody: unknown;
  try {
    jsonBody = await request.json();
  } catch {
    return json({ ok: false, reason: "invalid_json" }, 400);
  }

  const parsed = oneDriveNotificationSchema.safeParse(jsonBody);
  if (!parsed.success) {
    return json({ ok: false, reason: "invalid_json" }, 400);
  }

  const notifications = parsed.data.value ?? [];
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
    if (channel?.status !== "active") continue;
    // Fail closed: clientState must match the secret registered with Graph.
    if (!note.clientState || note.clientState !== channel.channelToken) {
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
