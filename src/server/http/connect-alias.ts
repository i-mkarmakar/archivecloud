import type { NextResponse } from "next/server";

const CONNECT_ALIAS_COOKIE = "archivecloud_connect_alias";
const MAX_ALIAS_LEN = 50;

/** Decode accidental URL-encoding (My%20Google%20Photos → My Google Photos). */
function decodeAliasEncoding(value: string): string {
  let current = value;
  // Cookie/query double-encoding leaves literal %20 in the stored name.
  for (let i = 0; i < 3; i += 1) {
    if (!/%[0-9A-Fa-f]{2}/.test(current)) break;
    try {
      const next = decodeURIComponent(current);
      if (next === current) break;
      current = next;
    } catch {
      break;
    }
  }
  return current;
}

export function parseConnectAliasParam(request: Request): string | null {
  const raw = new URL(request.url).searchParams.get("alias")?.trim() ?? "";
  return normalizeConnectAlias(raw);
}

export function normalizeConnectAlias(
  value: string | null | undefined,
): string | null {
  const trimmed = decodeAliasEncoding(value?.trim() ?? "").trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_ALIAS_LEN);
}

/** Cookie value: `<state>.<urlencoded-alias>` so state can be verified on callback. */
export function setConnectAliasCookie(
  response: NextResponse,
  state: string,
  alias: string | null,
) {
  if (!alias) {
    response.cookies.delete(CONNECT_ALIAS_COOKIE);
    return;
  }
  response.cookies.set({
    name: CONNECT_ALIAS_COOKIE,
    value: `${state}.${encodeURIComponent(alias)}`,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
}

export function clearConnectAliasCookie(response: NextResponse) {
  response.cookies.delete(CONNECT_ALIAS_COOKIE);
}

export function readConnectAliasFromRequest(
  request: Request,
  state: string,
): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  const match = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${CONNECT_ALIAS_COOKIE}=`));
  if (!match) return null;
  const raw = match.slice(CONNECT_ALIAS_COOKIE.length + 1);
  const sep = raw.indexOf(".");
  if (sep <= 0) return null;
  const cookieState = raw.slice(0, sep);
  let alias = "";
  try {
    alias = decodeURIComponent(raw.slice(sep + 1));
  } catch {
    return null;
  }
  const normalized = normalizeConnectAlias(alias);
  if (cookieState !== state || !normalized) return null;
  return normalized;
}

export function defaultProviderAlias(provider: string): string {
  switch (provider) {
    case "google_drive":
      return "My Google Drive";
    case "google_photos":
      return "My Google Photos";
    case "google_shared_drive":
      return "My Shared Drive";
    case "onedrive":
      return "My OneDrive";
    case "dropbox":
      return "My Dropbox";
    case "pcloud":
      return "My pCloud";
    case "icloud_drive":
      return "My iCloud Drive";
    case "icloud_photos":
      return "My iCloud Photos";
    default:
      return "My Cloud";
  }
}

export function resolveConnectedAccountAlias(params: {
  request: Request;
  state: string;
  provider: string;
  existingDisplayName?: string | null;
}): string {
  return (
    readConnectAliasFromRequest(params.request, params.state) ??
    normalizeConnectAlias(params.existingDisplayName) ??
    defaultProviderAlias(params.provider)
  );
}

export function oauthStateFromAuthUrl(oauthUrl: string): string | undefined {
  try {
    return new URL(oauthUrl).searchParams.get("state") ?? undefined;
  } catch {
    return undefined;
  }
}
