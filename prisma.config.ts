import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Use DIRECT_DATABASE_URL for migrations when DATABASE_URL points at a pooler (e.g. Neon).
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
