const APP_BOOT_KEY = "archivecloud.appBoot";

export function markAppBoot() {
  try {
    sessionStorage.setItem(APP_BOOT_KEY, String(Date.now()));
  } catch {}
}

export function hasAppBoot() {
  try {
    return Boolean(sessionStorage.getItem(APP_BOOT_KEY));
  } catch {
    return false;
  }
}

export function consumeAppBoot() {
  try {
    const value = sessionStorage.getItem(APP_BOOT_KEY);
    if (!value) return false;
    sessionStorage.removeItem(APP_BOOT_KEY);
    return true;
  } catch {
    return false;
  }
}

export const APP_BOOT_MIN_MS = 1400;
