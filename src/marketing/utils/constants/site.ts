export const APP_NAME = "ArchiveCloud";

export const APP_DOMAIN =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const APP_HOSTNAMES = new Set([APP_DOMAIN]);
