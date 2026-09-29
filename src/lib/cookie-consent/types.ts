export const COOKIE_CONSENT_VERSION = "1.0";
export const COOKIE_CONSENT_MAX_AGE_DAYS = 365;

export type CookieCategory = "necessary" | "preferences";

export type CookieCategoryPreferences = {
  necessary: true;
  preferences: boolean;
};

export type CookieConsentPreferences = {
  version: string;
  timestamp: string;
  categories: CookieCategoryPreferences;
};

export type CookieCategoryDefinition = {
  id: CookieCategory;
  title: string;
  description: string;
  alwaysActive?: boolean;
};
