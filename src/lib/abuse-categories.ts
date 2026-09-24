export const ABUSE_CATEGORIES = [
  "Spam or misleading",
  "Malware / Virus",
  "Copyright infringement",
  "Adult or explicit content",
  "Illegal content",
  "Other",
] as const;

export type AbuseCategory = (typeof ABUSE_CATEGORIES)[number];
