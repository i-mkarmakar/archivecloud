import { randomUUID } from "node:crypto";
import type { ConnectedAccount } from "@/generated/prisma/client";
import { prisma } from "@/server/config/prisma";
import { getOneDriveAccessToken } from "@/server/modules/onedrive/onedrive.service";
import { resolveWebhookBaseUrl } from "@/server/modules/webhooks/google-drive-watch";

const GRAPH = "https://graph.microsoft.com/v1.0";

const SUBSCRIPTION_MINUTES = 4000;
const RENEW_BEFORE_MS = 24 * 60 * 60 * 1000;

export async function ensureOneDriveSubscription(
  account: ConnectedAccount,
): Promise<{ registered: boolean; reason?: string }> {
  if (account.provider !== "onedrive") {
    return { registered: false, reason: "unsupported_provider" };
  }
  if (account.status !== "connected") {
    return { registered: false, reason: "disconnected" };
  }

  const baseUrl = resolveWebhookBaseUrl();
  if (!baseUrl) {
    return { registered: false, reason: "https_webhook_required" };
  }

  const existing = await prisma.providerWebhookChannel.findFirst({
    where: {
      connectedAccountId: account.id,
      provider: "onedrive",
      status: "active",
    },
    orderBy: { createdAt: "desc" },
  });

  if (
    existing?.expirationAt &&
    existing.expirationAt.getTime() - Date.now() > RENEW_BEFORE_MS
  ) {
    return { registered: true, reason: "already_active" };
  }

  const accessToken = await getOneDriveAccessToken(account);
  const clientState = randomUUID();
  const expirationDateTime = new Date(
    Date.now() + SUBSCRIPTION_MINUTES * 60 * 1000,
  ).toISOString();

  if (existing?.channelId) {
    await fetch(`${GRAPH}/subscriptions/${existing.channelId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => undefined);
    await prisma.providerWebhookChannel.update({
      where: { id: existing.id },
      data: { status: "superseded" },
    });
  }

  const response = await fetch(`${GRAPH}/subscriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      changeType: "updated",
      notificationUrl: `${baseUrl}/webhooks/onedrive`,
      resource: "/me/drive/root",
      expirationDateTime,
      clientState,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OneDrive subscription failed: ${text}`);
  }

  const data = (await response.json()) as {
    id: string;
    expirationDateTime?: string;
    resource?: string;
  };

  await prisma.providerWebhookChannel.create({
    data: {
      connectedAccountId: account.id,
      provider: "onedrive",
      channelId: data.id,
      resourceId: data.resource ?? "/me/drive/root",
      channelToken: clientState,
      expirationAt: data.expirationDateTime
        ? new Date(data.expirationDateTime)
        : new Date(expirationDateTime),
      status: "active",
      lastError: null,
    },
  });

  return { registered: true };
}

export async function stopOneDriveSubscriptions(
  accountId: string,
): Promise<void> {
  const channels = await prisma.providerWebhookChannel.findMany({
    where: {
      connectedAccountId: accountId,
      provider: "onedrive",
      status: "active",
    },
    include: { connectedAccount: true },
  });

  for (const channel of channels) {
    try {
      if (channel.connectedAccount.status === "connected") {
        const accessToken = await getOneDriveAccessToken(
          channel.connectedAccount,
        );
        await fetch(`${GRAPH}/subscriptions/${channel.channelId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      }
    } catch {}
    await prisma.providerWebhookChannel.update({
      where: { id: channel.id },
      data: { status: "stopped" },
    });
  }
}

export async function renewExpiringOneDriveSubscriptions(limit = 20): Promise<{
  renewed: number;
  failed: number;
}> {
  const cutoff = new Date(Date.now() + RENEW_BEFORE_MS);
  const channels = await prisma.providerWebhookChannel.findMany({
    where: {
      status: "active",
      provider: "onedrive",
      OR: [{ expirationAt: null }, { expirationAt: { lte: cutoff } }],
    },
    include: { connectedAccount: true },
    take: limit,
  });

  let renewed = 0;
  let failed = 0;

  for (const channel of channels) {
    try {
      const result = await ensureOneDriveSubscription(channel.connectedAccount);
      if (result.registered) renewed += 1;
    } catch (error) {
      failed += 1;
      const message =
        error instanceof Error ? error.message : "Subscription renew failed.";
      await prisma.providerWebhookChannel.update({
        where: { id: channel.id },
        data: { lastError: message, status: "error" },
      });
    }
  }

  return { renewed, failed };
}
