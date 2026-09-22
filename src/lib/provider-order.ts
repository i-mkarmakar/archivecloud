const PROVIDER_ORDER_KEY = "archivecloud.sidebar.providerOrder";
export const PROVIDER_ORDER_CHANGED_EVENT =
  "archivecloud:provider-order-changed";

export function loadProviderOrder(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PROVIDER_ORDER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function saveProviderOrder(order: string[]) {
  try {
    window.localStorage.setItem(PROVIDER_ORDER_KEY, JSON.stringify(order));
    window.dispatchEvent(new Event(PROVIDER_ORDER_CHANGED_EVENT));
  } catch {}
}

export function sortByProviderOrder<T extends { provider: string }>(
  items: T[],
  order: string[],
): T[] {
  if (order.length === 0 || items.length < 2) return items;
  const rank = new Map(order.map((provider, index) => [provider, index]));
  return [...items].sort((a, b) => {
    const ai = rank.get(a.provider) ?? Number.MAX_SAFE_INTEGER;
    const bi = rank.get(b.provider) ?? Number.MAX_SAFE_INTEGER;
    return ai - bi;
  });
}

/** Flatten accounts in sidebar provider order (then keep relative order within a provider). */
export function sortAccountsByProviderOrder<T extends { provider: string }>(
  accounts: T[],
  order: string[],
): T[] {
  if (order.length === 0 || accounts.length < 2) return accounts;

  const groups: { provider: string; accounts: T[] }[] = [];
  const indexByProvider = new Map<string, number>();
  for (const account of accounts) {
    const existing = indexByProvider.get(account.provider);
    if (existing !== undefined) {
      groups[existing].accounts.push(account);
      continue;
    }
    indexByProvider.set(account.provider, groups.length);
    groups.push({ provider: account.provider, accounts: [account] });
  }

  return sortByProviderOrder(groups, order).flatMap((group) => group.accounts);
}
