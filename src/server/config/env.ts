import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(3000),
  APP_URL: z.string().url().default("http://localhost:3000"),
  CLERK_SECRET_KEY: z.string().min(1),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  TOKEN_ENCRYPTION_KEY: z.string().min(32),
  MAX_UPLOAD_BYTES: z.coerce.number().default(5 * 1024 * 1024 * 1024),
});

const isNextBuild = process.env.NEXT_PHASE === "phase-production-build";

const buildPlaceholders = isNextBuild
  ? {
      DATABASE_URL: "postgresql://build@localhost:5432/build",
      CLERK_SECRET_KEY: "sk_test_build_placeholder_clerk_secret_key",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
        "pk_test_build_placeholder_clerk_publishable_key",
      TOKEN_ENCRYPTION_KEY: "build-placeholder-encryption-key-32b!",
    }
  : {};

export const env = envSchema.parse({
  ...process.env,
  ...buildPlaceholders,
  APP_URL:
    process.env.APP_URL ?? process.env.FRONTEND_URL ?? "http://localhost:3000",
});
