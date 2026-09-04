import { NextResponse, type NextRequest } from "next/server";

const publicRoutePrefixes = [
  "/auth",
  "/signin",
  "/signup",
  "/verify-email",
  "/google-auth",
  "/google-connected",
  "/public/files",
  "/api/public",
  "/api/auth",
  "/files/preview",
  "/health",
  "/svgl",
  "/connected-accounts/google/callback",
  "/terms",
  "/privacy",
];

function isPublicRoute(pathname: string) {
  if (pathname === "/") {
    return true;
  }

  return publicRoutePrefixes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function isAuthPage(pathname: string) {
  return (
    pathname === "/auth/sign-in" ||
    pathname === "/auth/sign-up" ||
    pathname === "/signin" ||
    pathname === "/signup"
  );
}

function hasAuthSession(request: NextRequest) {
  return request.cookies.getAll().some((cookie) => {
    const normalized = cookie.name.replace(/^(__Secure-|__Host-)/, "");
    return (
      normalized === "archivecloud.session_token" ||
      normalized === "archivecloud.session_data"
    );
  });
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/" && hasAuthSession(request)) {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  if (isPublicRoute(pathname)) {
    if (isAuthPage(pathname) && hasAuthSession(request)) {
      return NextResponse.redirect(new URL("/home", request.url));
    }
    return NextResponse.next();
  }

  if (!hasAuthSession(request)) {
    const signInUrl = new URL("/auth/sign-in", request.url);
    if (pathname !== "/") {
      signInUrl.searchParams.set("callbackUrl", pathname);
    }
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
