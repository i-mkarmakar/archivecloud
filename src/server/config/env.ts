import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

function normalizeBaseUrl(url: string | undefined): string | undefined {
  if (!url?.trim()) return undefined;
  return url.trim().replace(/\/$/, "");
}

const optionalNonEmptyString = z.preprocess(
  (value) => (typeof value === "string" && !value.trim() ? undefined : value),
  z.string().min(1).optional(),
);

function resolveAbsoluteUrl(
  value: string | undefined,
  fallback: string,
): string {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  try {
    new URL(trimmed);
    return trimmed;
  } catch {
    return fallback;
  }
}

function resolvePublicAppUrl(): string {
  return (
    normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ??
    normalizeBaseUrl(process.env.SITE_URL) ??
    normalizeBaseUrl(process.env.APP_URL) ??
    normalizeBaseUrl(process.env.FRONTEND_URL) ??
    "http://localhost:9050"
  );
}

function resolveBetterAuthUrl(): string {
  return normalizeBaseUrl(process.env.BETTER_AUTH_URL) ?? resolvePublicAppUrl();
}

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(9050),
  APP_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  TOKEN_ENCRYPTION_KEY: z.string().min(32),
  MAX_UPLOAD_BYTES: z.coerce.number().default(5 * 1024 * 1024 * 1024),
  GOOGLE_CLIENT_ID: optionalNonEmptyString,
  GOOGLE_CLIENT_SECRET: optionalNonEmptyString,
  GOOGLE_REDIRECT_URI: z.string().url(),
  DROPBOX_CLIENT_ID: optionalNonEmptyString,
  DROPBOX_CLIENT_SECRET: optionalNonEmptyString,
  DROPBOX_REDIRECT_URI: z.string().url(),
  ONEDRIVE_CLIENT_ID: optionalNonEmptyString,
  ONEDRIVE_CLIENT_SECRET: optionalNonEmptyString,
  ONEDRIVE_REDIRECT_URI: z.string().url(),
  PCLOUD_CLIENT_ID: optionalNonEmptyString,
  PCLOUD_CLIENT_SECRET: optionalNonEmptyString,
  PCLOUD_REDIRECT_URI: z.string().url(),
  GOOGLE_PHOTOS_REDIRECT_URI: z.string().url(),
  GOOGLE_SHARED_DRIVE_REDIRECT_URI: z.string().url(),
  RESEND_API_KEY: optionalNonEmptyString,
  RESEND_FROM_EMAIL: optionalNonEmptyString,
  CRON_SECRET: z.preprocess(
    (value) => (typeof value === "string" && !value.trim() ? undefined : value),
    z.string().min(16).optional(),
  ),

  WEBHOOK_BASE_URL: z.string().url().optional(),

  POLAR_ACCESS_TOKEN: optionalNonEmptyString,

  POLAR_WEBHOOK_SECRET: optionalNonEmptyString,

  POLAR_SERVER: z.enum(["sandbox", "production"]).default("sandbox"),

  POLAR_PRODUCT_THUNDER_LIFETIME: optionalNonEmptyString,

  POLAR_PRODUCT_POWER_LIFETIME: optionalNonEmptyString,

  ADMIN_EMAIL: optionalNonEmptyString,

  ADMIN_NAME: optionalNonEmptyString,

  DEFAULT_USER_PLAN: z.preprocess((value) => {
    if (typeof value === "string" && !value.trim()) return undefined;
    if (value === "power" || value === "plus" || value === "pro")
      return "thunder";
    return value;
  }, z.enum(["free", "thunder"]).optional()),

  BILLING_ENABLED: z.preprocess((value) => {
    if (value === undefined || value === "") return undefined;
    if (typeof value === "boolean") return value;
    const normalized = String(value).trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no") {
      return false;
    }
    return value;
  }, z.boolean().optional()),

  /** Cloudflare Turnstile secret (server-only). When unset, captcha is disabled. */
  TURNSTILE_SECRET_KEY: optionalNonEmptyString,

  /** Optional GitHub PAT for star-count API rate limits (server-only). */
  GITHUB_TOKEN: optionalNonEmptyString,
});

const isNextBuild =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.npm_lifecycle_event === "build";

const publicAppUrl = resolvePublicAppUrl();
const betterAuthUrl = resolveBetterAuthUrl();

const buildPlaceholders = isNextBuild
  ? {
      DATABASE_URL: "postgresql://build@localhost:5432/build",
      BETTER_AUTH_SECRET: "build-placeholder-better-auth-secret-32",
      BETTER_AUTH_URL: "http://localhost:9050",
      NEXT_PUBLIC_APP_URL: "http://localhost:9050",
      SITE_URL: "http://localhost:9050",
      TOKEN_ENCRYPTION_KEY: "build-placeholder-encryption-key-32b!",
      GOOGLE_CLIENT_ID: "build-google-client-id",
      GOOGLE_CLIENT_SECRET: "build-google-client-secret",
      GOOGLE_REDIRECT_URI:
        "http://localhost:9050/connected-accounts/google/callback",
      DROPBOX_CLIENT_ID: "build-dropbox-client-id",
      DROPBOX_CLIENT_SECRET: "build-dropbox-client-secret",
      DROPBOX_REDIRECT_URI:
        "http://localhost:9050/connected-accounts/dropbox/callback",
      ONEDRIVE_CLIENT_ID: "build-onedrive-client-id",
      ONEDRIVE_CLIENT_SECRET: "build-onedrive-client-secret",
      ONEDRIVE_REDIRECT_URI:
        "http://localhost:9050/connected-accounts/onedrive/callback",
      PCLOUD_CLIENT_ID: "build-pcloud-client-id",
      PCLOUD_CLIENT_SECRET: "build-pcloud-client-secret",
      PCLOUD_REDIRECT_URI:
        "http://localhost:9050/connected-accounts/pcloud/callback",
      GOOGLE_PHOTOS_REDIRECT_URI:
        "http://localhost:9050/connected-accounts/google-photos/callback",
      GOOGLE_SHARED_DRIVE_REDIRECT_URI:
        "http://localhost:9050/connected-accounts/google-shared-drive/callback",
      CRON_SECRET: "build-cron-secret-placeholder!",
    }
  : {};

export const env = envSchema.parse({
  ...process.env,
  ...buildPlaceholders,
  APP_URL: publicAppUrl,
  BETTER_AUTH_URL: betterAuthUrl,
  GOOGLE_REDIRECT_URI: resolveAbsoluteUrl(
    process.env.GOOGLE_REDIRECT_URI,
    `${publicAppUrl}/connected-accounts/google/callback`,
  ),
  DROPBOX_REDIRECT_URI: resolveAbsoluteUrl(
    process.env.DROPBOX_REDIRECT_URI,
    `${publicAppUrl}/connected-accounts/dropbox/callback`,
  ),
  ONEDRIVE_REDIRECT_URI: resolveAbsoluteUrl(
    process.env.ONEDRIVE_REDIRECT_URI,
    `${publicAppUrl}/connected-accounts/onedrive/callback`,
  ),
  PCLOUD_REDIRECT_URI: resolveAbsoluteUrl(
    process.env.PCLOUD_REDIRECT_URI,
    `${publicAppUrl}/connected-accounts/pcloud/callback`,
  ),
  GOOGLE_PHOTOS_REDIRECT_URI: resolveAbsoluteUrl(
    process.env.GOOGLE_PHOTOS_REDIRECT_URI,
    `${publicAppUrl}/connected-accounts/google-photos/callback`,
  ),
  GOOGLE_SHARED_DRIVE_REDIRECT_URI: resolveAbsoluteUrl(
    process.env.GOOGLE_SHARED_DRIVE_REDIRECT_URI,
    `${publicAppUrl}/connected-accounts/google-shared-drive/callback`,
  ),
  WEBHOOK_BASE_URL: process.env.WEBHOOK_BASE_URL?.trim()
    ? resolveAbsoluteUrl(process.env.WEBHOOK_BASE_URL, publicAppUrl)
    : undefined,
});
