import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import {
  isAuthEntryPath,
  normalizeAppPath,
  safeCallbackUrl,
} from "@/lib/safe-callback-url";

function isPublicFileApi(pathname: string) {
  return (
    /^\/public\/files\/[^/]+\/(download|preview)\/?$/.test(pathname) ||
    pathname.startsWith("/api/public/")
  );
}

function redirectLocalePrefix(request: NextRequest, pathname: string) {
  const normalized = normalizeAppPath(pathname);
  if (normalized === pathname) return null;
  const url = request.nextUrl.clone();
  url.pathname = normalized;
  return NextResponse.redirect(url);
}

const publicRoutePrefixes = [
  "/auth",
  "/login",
  "/signin",
  "/signup",
  "/verify-email",
  "/google-auth",
  "/google-connected",
  "/public/files",
  "/api/public",
  "/api/auth",
  "/api/v1",
  "/api/webhooks",
  "/files/preview",
  "/health",
  "/connected-accounts/google/callback",
  "/connected-accounts/dropbox/callback",
  "/connected-accounts/onedrive/callback",
  "/connected-accounts/pcloud/callback",
  "/connected-accounts/google-photos/callback",
  "/connected-accounts/google-shared-drive/callback",
  "/dropbox-connected",
  "/onedrive-connected",
  "/pcloud-connected",
  "/google-photos-connected",
  "/google-shared-connected",
  "/terms-of-service",
  "/privacy-policy",
  "/refund-policy",
  "/cookie-policy",
  "/faqs",
  "/help",
  "/security",
  "/solutions",
  "/cron",
  "/webhooks",
  "/.well-known",
  "/embed",
];

const SESSION_COOKIE_NAMES = [
  "archivecloud.session_token",
  "archivecloud.session_data",
  "__Secure-archivecloud.session_token",
  "__Secure-archivecloud.session_data",
  "__Host-archivecloud.session_token",
  "__Host-archivecloud.session_data",
];

/**
 * Route Handler prefixes that skip the proxy session redirect so handlers
 * can return JSON 401 via requireAuthUser.
 *
 * Some prefixes collide with dashboard *pages* (e.g. `/shared` page vs
 * `/shared/cloud-folders` API). Those exact page paths are excluded below.
 */
const apiPrefixes = [
  "/account",
  "/api-keys",
  "/audit",
  "/automation",
  "/billing",
  "/connected-accounts",
  "/cron",
  "/files",
  "/folders",
  "/health",
  "/invites",
  "/notifications",
  "/search",
  "/shared",
  "/storage",
  "/sync",
  "/tags",
  "/transfers",
  "/uploads",
  "/vf",
  "/webhooks",
] as const;

/**
 * App pages that share a URL prefix with Route Handlers. These must still
 * go through the session gate (same as `/home`).
 */
const sessionGatedPagePaths = new Set([
  "/shared",
  "/search",
  "/automation",
  "/billing/history",
  "/billing/success",
]);

function stripTrailingSlash(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function isPublicRoute(pathname: string) {
  if (pathname === "/") {
    return true;
  }

  return publicRoutePrefixes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function isApiAuthBypassPath(pathname: string) {
  const path = stripTrailingSlash(pathname);
  if (sessionGatedPagePaths.has(path)) {
    return false;
  }

  return apiPrefixes.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

function hasSessionCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some((cookie) => SESSION_COOKIE_NAMES.includes(cookie.name));
}

async function getValidatedSession(request: NextRequest) {
  return auth.api.getSession({ headers: request.headers });
}

function clearSessionCookies(response: NextResponse) {
  for (const name of SESSION_COOKIE_NAMES) {
    response.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
}

function redirectToSignIn(request: NextRequest, pathname: string) {
  const signInUrl = new URL("/auth/sign-in", request.url);
  // Never persist auth-entry aliases (e.g. /login) as callbackUrl.
  const callbackPath = safeCallbackUrl(pathname, "");
  if (callbackPath && !isAuthEntryPath(callbackPath)) {
    signInUrl.searchParams.set("callbackUrl", callbackPath);
  }
  const response = NextResponse.redirect(signInUrl);
  clearSessionCookies(response);
  return response;
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicFileApi(pathname) || pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const localeRedirect = redirectLocalePrefix(request, pathname);
  if (localeRedirect) {
    return localeRedirect;
  }

  if (isApiAuthBypassPath(pathname)) {
    return NextResponse.next();
  }

  const cookiePresent = hasSessionCookie(request);
  const session = cookiePresent ? await getValidatedSession(request) : null;

  if (pathname === "/" && session) {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  if (!session) {
    return redirectToSignIn(request, pathname);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
