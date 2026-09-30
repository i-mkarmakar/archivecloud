export const CONNECT_ALIAS_MAX_LEN = 50;

/** Letters, numbers, spaces, underscores, dots, hyphens. */
const DISALLOWED = /[^a-zA-Z0-9 _.-]/g;

export function sanitizeConnectAliasInput(value: string): string {
  return value.replace(DISALLOWED, "").slice(0, CONNECT_ALIAS_MAX_LEN);
}
