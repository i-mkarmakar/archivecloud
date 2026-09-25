import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma CLI runs outside Next — do not import src/server/config/env.ts here.
const migrationDatabaseUrl =
  process.env.DIRECT_DATABASE_URL?.trim() || env("DATABASE_URL");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: migrationDatabaseUrl,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL?.trim() || undefined,
  },
});
