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

function hasFolderTagDelegate(client: PrismaClient) {
  return (
    typeof (client as { folderTag?: { findMany?: unknown } }).folderTag
      ?.findMany === "function"
  );
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaFolderTagRefreshDone?: boolean;
};

function getPrismaClient() {
  const existing = globalForPrisma.prisma;
  if (existing && hasFolderTagDelegate(existing)) {
    return existing;
  }

  // Replace a pre-FolderTag HMR singleton once, then keep whatever we get.
  if (existing && !globalForPrisma.prismaFolderTagRefreshDone) {
    globalForPrisma.prismaFolderTagRefreshDone = true;
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
