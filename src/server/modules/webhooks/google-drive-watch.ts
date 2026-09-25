import "server-only";

import { randomUUID } from "node:crypto";
import type { ConnectedAccount } from "@/generated/prisma/client";
import { env } from "@/server/config/env";
import { prisma } from "@/server/config/prisma";
import {
  getGoogleDriveChangesStartPageToken,
  stopGoogleDriveChannel,
  watchGoogleDriveChanges,
} from "@/server/modules/providers/google/google-drive-changes";

const GOOGLE_PROVIDERS = new Set(["google_drive", "google_shared_drive"]);

const WATCH_TTL_MS = 6 * 24 * 60 * 60 * 1000;
const RENEW_BEFORE_MS = 24 * 60 * 60 * 1000;

export function resolveWebhookBaseUrl(): string | null {
  const base = (env.WEBHOOK_BASE_URL ?? env.APP_URL).replace(/\/$/, "");
  if (!base.startsWith("https://")) return null;
  return base;
}

export function isGoogleWatchableProvider(provider: string): boolean {
  return GOOGLE_PROVIDERS.has(provider);
}

export async function ensureGoogleDriveWatch(
  account: ConnectedAccount,
): Promise<{ registered: boolean; reason?: string }> {
  if (!isGoogleWatchableProvider(account.provider)) {
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
      provider: account.provider,
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

  const pageToken = await getGoogleDriveChangesStartPageToken(account);

  const channelId = randomUUID();
  const channelToken = randomUUID();
  const expirationMs = Date.now() + WATCH_TTL_MS;

  const watch = await watchGoogleDriveChanges(account, {
    pageToken,
    channelId,
    channelToken,
    address: `${baseUrl}/webhooks/google-drive`,
    expirationMs,
  });

  if (existing) {
    await prisma.providerWebhookChannel.update({
      where: { id: existing.id },
      data: { status: "superseded" },
    });
    if (existing.resourceId) {
      try {
        await stopGoogleDriveChannel(account, {
          channelId: existing.channelId,
          resourceId: existing.resourceId,
        });
      } catch {}
    }
  }

  await prisma.providerWebhookChannel.create({
    data: {
      connectedAccountId: account.id,
      provider: account.provider,
      channelId,
      resourceId: watch.resourceId,
      channelToken,
      pageToken,
      expirationAt: watch.expirationAt,
      status: "active",
      lastError: null,
    },
  });

  return { registered: true };
}

export async function stopGoogleDriveWatches(accountId: string): Promise<void> {
  const channels = await prisma.providerWebhookChannel.findMany({
    where: {
      connectedAccountId: accountId,
      status: "active",
      provider: { in: [...GOOGLE_PROVIDERS] },
    },
    include: { connectedAccount: true },
  });

  for (const channel of channels) {
    try {
      if (
        channel.resourceId &&
        channel.connectedAccount.status === "connected"
      ) {
        await stopGoogleDriveChannel(channel.connectedAccount, {
          channelId: channel.channelId,
          resourceId: channel.resourceId,
        });
      }
    } catch {}
    await prisma.providerWebhookChannel.update({
      where: { id: channel.id },
      data: { status: "stopped" },
    });
  }
}

export async function renewExpiringGoogleDriveWatches(limit = 20): Promise<{
  renewed: number;
  failed: number;
}> {
  const cutoff = new Date(Date.now() + RENEW_BEFORE_MS);
  const channels = await prisma.providerWebhookChannel.findMany({
    where: {
      status: "active",
      provider: { in: [...GOOGLE_PROVIDERS] },
      OR: [{ expirationAt: null }, { expirationAt: { lte: cutoff } }],
    },
    include: { connectedAccount: true },
    take: limit,
  });

  let renewed = 0;
  let failed = 0;

  for (const channel of channels) {
    try {
      const result = await ensureGoogleDriveWatch(channel.connectedAccount);
      if (result.registered) renewed += 1;
    } catch (error) {
      failed += 1;
      const message =
        error instanceof Error ? error.message : "Watch renew failed.";
      await prisma.providerWebhookChannel.update({
        where: { id: channel.id },
        data: { lastError: message, status: "error" },
      });
    }
  }

  return { renewed, failed };
}
