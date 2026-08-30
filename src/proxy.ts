import { clerkMiddleware } from "@clerk/nextjs/server";

// Signed-out routes that must stay reachable. Native path checks —
// createRouteMatcher is deprecated for middleware auth gating.
const PUBLIC_PREFIXES = [
  "/signin",
  "/signup",
  "/google-auth",
  "/google-connected",
  "/public/files",
  "/api/public",
  "/api/v1",
  "/files/preview",
  "/health",
  "/connected-accounts/google/callback",
  "/login",
] as const;

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export default clerkMiddleware(
  async (auth, request) => {
    if (!isPublicPath(request.nextUrl.pathname)) {
      await auth.protect();
    }
  },
  {
    frontendApiProxy: {
      enabled: true,
    },
  },
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
