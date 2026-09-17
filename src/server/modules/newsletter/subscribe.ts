import "server-only";

import { prisma } from "@/server/config/prisma";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function subscribeUserToNewsletter(params: {
  userId: string;
  email: string;
  source?: string;
}) {
  const email = normalizeEmail(params.email);
  if (!email) return null;

  const now = new Date();
  const existing =
    (await prisma.newsletterSubscriber.findUnique({
      where: { userId: params.userId },
    })) ??
    (await prisma.newsletterSubscriber.findUnique({
      where: { email },
    }));

  if (existing) {
    return prisma.newsletterSubscriber.update({
      where: { id: existing.id },
      data: {
        userId: params.userId,
        email,
        subscribed: true,
        source: params.source ?? "signup",
        subscribedAt: now,
        unsubscribedAt: null,
      },
    });
  }

  return prisma.newsletterSubscriber.create({
    data: {
      userId: params.userId,
      email,
      subscribed: true,
      source: params.source ?? "signup",
      subscribedAt: now,
      unsubscribedAt: null,
    },
  });
}

export async function ensureNewsletterPreference(params: {
  userId: string;
  email: string;
}) {
  const email = normalizeEmail(params.email);
  const existing =
    (await prisma.newsletterSubscriber.findUnique({
      where: { userId: params.userId },
    })) ??
    (email
      ? await prisma.newsletterSubscriber.findUnique({ where: { email } })
      : null);

  if (existing) {
    if (existing.userId !== params.userId || existing.email !== email) {
      return prisma.newsletterSubscriber.update({
        where: { id: existing.id },
        data: { userId: params.userId, email },
      });
    }
    return existing;
  }

  return subscribeUserToNewsletter({
    userId: params.userId,
    email,
    source: "settings_default",
  });
}

export async function getNewsletterPreference(userId: string) {
  const row = await prisma.newsletterSubscriber.findUnique({
    where: { userId },
    select: { subscribed: true, email: true },
  });
  return {
    subscribed: row?.subscribed ?? true,
    email: row?.email ?? null,
  };
}

export async function setNewsletterPreference(params: {
  userId: string;
  email: string;
  subscribed: boolean;
}) {
  const email = normalizeEmail(params.email);
  const now = new Date();

  const existing =
    (await prisma.newsletterSubscriber.findUnique({
      where: { userId: params.userId },
    })) ??
    (await prisma.newsletterSubscriber.findUnique({
      where: { email },
    }));

  const data = {
    userId: params.userId,
    email,
    subscribed: params.subscribed,
    source: "settings",
    ...(params.subscribed
      ? { subscribedAt: now, unsubscribedAt: null }
      : { unsubscribedAt: now }),
  };

  if (existing) {
    return prisma.newsletterSubscriber.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.newsletterSubscriber.create({
    data: {
      ...data,
      subscribedAt: now,
    },
  });
}
