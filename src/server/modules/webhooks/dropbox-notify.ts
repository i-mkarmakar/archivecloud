import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/server/config/env";
import { prisma } from "@/server/config/prisma";
import { scheduleFolderSyncsForAccount } from "@/server/modules/webhooks/trigger-account-syncs";

export function verifyDropboxSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const secret = env.DROPBOX_CLIENT_SECRET?.trim();
  if (!secret || secret.startsWith("build-")) {
    return true;
  }
  if (!signatureHeader) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = signatureHeader.trim().toLowerCase();
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(provided, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function handleDropboxAccountNotifications(
  accountIds: string[],
): Promise<{ matched: number }> {
  const unique = [...new Set(accountIds.filter(Boolean))];
  if (unique.length === 0) return { matched: 0 };

  const accounts = await prisma.connectedAccount.findMany({
    where: {
      provider: "dropbox",
      status: "connected",
      providerAccountId: { in: unique },
    },
    select: { id: true, providerAccountId: true },
  });

  for (const account of accounts) {
    await prisma.providerWebhookChannel.upsert({
      where: {
        provider_channelId: {
          provider: "dropbox",
          channelId: account.providerAccountId,
        },
      },
      create: {
        connectedAccountId: account.id,
        provider: "dropbox",
        channelId: account.providerAccountId,
        channelToken: "dropbox-app-webhook",
        status: "active",
        lastNotifiedAt: new Date(),
      },
      update: {
        status: "active",
        lastNotifiedAt: new Date(),
        connectedAccountId: account.id,
        lastError: null,
      },
    });

    scheduleFolderSyncsForAccount(account.id, "dropbox_webhook");
  }

  return { matched: accounts.length };
}

export async function ensureDropboxWebhookCursor(
  accountId: string,
  providerAccountId: string,
): Promise<void> {
  await prisma.providerWebhookChannel.upsert({
    where: {
      provider_channelId: {
        provider: "dropbox",
        channelId: providerAccountId,
      },
    },
    create: {
      connectedAccountId: accountId,
      provider: "dropbox",
      channelId: providerAccountId,
      channelToken: "dropbox-app-webhook",
      status: "active",
    },
    update: {
      connectedAccountId: accountId,
      status: "active",
      lastError: null,
    },
  });
}
