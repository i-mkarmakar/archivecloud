import {
  ALL_COOKIES_ACCEPTED,
  ALL_NON_ESSENTIAL_REJECTED,
} from "@/lib/cookie-consent/config";
import {
  COOKIE_CONSENT_NAME,
  COOKIE_CONSENT_UPDATED_EVENT,
  PREFERENCE_STORAGE_PREFIXES,
} from "@/lib/cookie-consent/storage-keys";
import {
  COOKIE_CONSENT_MAX_AGE_DAYS,
  COOKIE_CONSENT_VERSION,
  type CookieCategory,
  type CookieConsentPreferences,
} from "@/lib/cookie-consent/types";

export {
  COOKIE_CONSENT_NAME,
  COOKIE_CONSENT_UPDATED_EVENT,
} from "@/lib/cookie-consent/storage-keys";

function isBrowser() {
  return typeof window !== "undefined";
}

function parseConsent(raw: string): CookieConsentPreferences | null {
  try {
    const parsed = JSON.parse(
      decodeURIComponent(raw),
    ) as CookieConsentPreferences;
    if (!parsed?.categories || parsed.categories.necessary !== true) {
      return null;
    }
    if (typeof parsed.categories.preferences !== "boolean") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function readCookieValue(name: string): string | null {
  const match = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`));
  if (!match) return null;
  return match.slice(name.length + 1);
}

export function readConsent(): CookieConsentPreferences | null {
  if (!isBrowser()) return null;
  const raw = readCookieValue(COOKIE_CONSENT_NAME);
  if (!raw) return null;
  return parseConsent(raw);
}

export function writeConsent(
  categories: CookieConsentPreferences["categories"],
): CookieConsentPreferences {
  const preferences: CookieConsentPreferences = {
    version: COOKIE_CONSENT_VERSION,
    timestamp: new Date().toISOString(),
    categories,
  };

  if (isBrowser()) {
    const encoded = encodeURIComponent(JSON.stringify(preferences));
    const maxAge = COOKIE_CONSENT_MAX_AGE_DAYS * 24 * 60 * 60;
    document.cookie = `${COOKIE_CONSENT_NAME}=${encoded}; path=/; max-age=${maxAge}; SameSite=Lax`;
    window.dispatchEvent(
      new CustomEvent(COOKIE_CONSENT_UPDATED_EVENT, { detail: preferences }),
    );
  }

  return preferences;
}

export function acceptAllConsent(): CookieConsentPreferences {
  return writeConsent(ALL_COOKIES_ACCEPTED);
}

export function rejectAllConsent(): CookieConsentPreferences {
  return writeConsent(ALL_NON_ESSENTIAL_REJECTED);
}

export function hasCategoryConsent(category: CookieCategory): boolean {
  if (category === "necessary") return true;
  const consent = readConsent();
  if (!consent) return false;
  return consent.categories[category];
}

export function clearPreferenceStorageKeys() {
  if (!isBrowser()) return;

  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (PREFERENCE_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      keysToRemove.push(key);
    }
  }

  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }
}
