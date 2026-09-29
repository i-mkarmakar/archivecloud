import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/server/config/env";

function createPrismaClient() {
  const connectionString = env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

function hasRequiredDelegates(client: PrismaClient) {
  const c = client as {
    folderTag?: { findMany?: unknown };
    notification?: { findMany?: unknown };
  };
  return (
    typeof c.folderTag?.findMany === "function" &&
    typeof c.notification?.findMany === "function"
  );
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaDelegateRefreshDone?: boolean;
};

function getPrismaClient() {
  const existing = globalForPrisma.prisma;
  if (existing && hasRequiredDelegates(existing)) {
    return existing;
  }

  // Replace a stale HMR singleton once (missing new model delegates), then keep it.
  if (existing && !globalForPrisma.prismaDelegateRefreshDone) {
    globalForPrisma.prismaDelegateRefreshDone = true;
    void existing.$disconnect().catch(() => undefined);
    const client = createPrismaClient();
    globalForPrisma.prisma = client;
    return client;
  }

  if (!existing) {
    const client = createPrismaClient();
    globalForPrisma.prisma = client;
    return client;
  }

  return existing;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});
