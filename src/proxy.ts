import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/signin",
  "/signup",
  "/signin/sso-callback",
  "/signup/sso-callback",
  "/google-auth",
  "/google-connected",
  "/public/files(.*)",
  "/api/public(.*)",
  "/api/v1(.*)",
  "/files/preview(.*)",
  "/health",
  "/connected-accounts/google/callback",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
