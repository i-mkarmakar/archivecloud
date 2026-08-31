import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

function normalizeBaseUrl(url: string | undefined): string | undefined {
  if (!url?.trim()) return undefined;
  return url.trim().replace(/\/$/, "");
}

function resolvePublicAppUrl(): string {
  return (
    normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ??
    normalizeBaseUrl(process.env.SITE_URL) ??
    normalizeBaseUrl(process.env.APP_URL) ??
    normalizeBaseUrl(process.env.FRONTEND_URL) ??
    "http://localhost:3000"
  );
}

function resolveBetterAuthUrl(): string {
  return normalizeBaseUrl(process.env.BETTER_AUTH_URL) ?? resolvePublicAppUrl();
}

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(3000),
  APP_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  TOKEN_ENCRYPTION_KEY: z.string().min(32),
  MAX_UPLOAD_BYTES: z.coerce.number().default(5 * 1024 * 1024 * 1024),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_REDIRECT_URI: z.string().url(),
});

const isNextBuild = process.env.NEXT_PHASE === "phase-production-build";

const publicAppUrl = resolvePublicAppUrl();
const betterAuthUrl = resolveBetterAuthUrl();

const buildPlaceholders = isNextBuild
  ? {
      DATABASE_URL: "postgresql://build@localhost:5432/build",
      BETTER_AUTH_SECRET: "build-placeholder-better-auth-secret-32",
      BETTER_AUTH_URL: "http://localhost:3000",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      SITE_URL: "http://localhost:3000",
      TOKEN_ENCRYPTION_KEY: "build-placeholder-encryption-key-32b!",
      GOOGLE_CLIENT_ID: "build-google-client-id",
      GOOGLE_CLIENT_SECRET: "build-google-client-secret",
      GOOGLE_REDIRECT_URI:
        "http://localhost:3000/connected-accounts/google/callback",
    }
  : {};

export const env = envSchema.parse({
  ...process.env,
  ...buildPlaceholders,
  APP_URL: publicAppUrl,
  BETTER_AUTH_URL: betterAuthUrl,
  GOOGLE_REDIRECT_URI:
    process.env.GOOGLE_REDIRECT_URI ??
    `${publicAppUrl}/connected-accounts/google/callback`,
});
