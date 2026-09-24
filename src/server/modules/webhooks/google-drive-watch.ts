import "server-only";

import { randomUUID } from "node:crypto";
import { google } from "googleapis";
import type { ConnectedAccount } from "@/generated/prisma/client";
import { env } from "@/server/config/env";
import { prisma } from "@/server/config/prisma";
import { getAuthedGoogleClient } from "@/server/modules/google/google.service";

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

  const auth = await getAuthedGoogleClient(account);
  const drive = google.drive({ version: "v3", auth });

  const startPage = await drive.changes.getStartPageToken({
    supportsAllDrives: true,
  });
  const pageToken = startPage.data.startPageToken;
  if (!pageToken) {
    throw new Error("Google Drive did not return a start page token.");
  }

  const channelId = randomUUID();
  const channelToken = randomUUID();
  const expirationMs = Date.now() + WATCH_TTL_MS;

  const watch = await drive.changes.watch({
    pageToken,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    requestBody: {
      id: channelId,
      type: "web_hook",
      address: `${baseUrl}/webhooks/google-drive`,
      token: channelToken,
      expiration: String(expirationMs),
    },
  });

  const resourceId = watch.data.resourceId ?? null;
  const expirationAt = watch.data.expiration
    ? new Date(Number(watch.data.expiration))
    : new Date(expirationMs);

  if (existing) {
    await prisma.providerWebhookChannel.update({
      where: { id: existing.id },
      data: { status: "superseded" },
    });
    if (existing.resourceId) {
      try {
        await drive.channels.stop({
          requestBody: {
            id: existing.channelId,
            resourceId: existing.resourceId,
          },
        });
      } catch {}
    }
  }

  await prisma.providerWebhookChannel.create({
    data: {
      connectedAccountId: account.id,
      provider: account.provider,
      channelId,
      resourceId,
      channelToken,
      pageToken,
      expirationAt,
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
        const auth = await getAuthedGoogleClient(channel.connectedAccount);
        const drive = google.drive({ version: "v3", auth });
        await drive.channels.stop({
          requestBody: {
            id: channel.channelId,
            resourceId: channel.resourceId,
          },
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
