const HAS_CONNECTED_ACCOUNTS_KEY = "archivecloud:has-connected-accounts";

/** Last-known connected-account presence for choosing the right home loading UI. */
export function readHasConnectedAccountsHint(): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(HAS_CONNECTED_ACCOUNTS_KEY);
    if (value === "1") return true;
    if (value === "0") return false;
  } catch {
    // ignore storage failures
  }
  return null;
}

export function writeHasConnectedAccountsHint(hasConnected: boolean) {
  try {
    localStorage.setItem(HAS_CONNECTED_ACCOUNTS_KEY, hasConnected ? "1" : "0");
  } catch {
    // ignore storage failures
  }
}

export function clearHasConnectedAccountsHint() {
  try {
    localStorage.removeItem(HAS_CONNECTED_ACCOUNTS_KEY);
  } catch {
    // ignore storage failures
  }
}
