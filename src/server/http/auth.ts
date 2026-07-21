import { auth } from "@clerk/nextjs/server";
import { resolveAppUser } from "@/server/lib/resolve-app-user";
import { errorJson } from "./responses";

export type AuthUser = { id: string; clerkUserId: string };

export async function requireAuthUser(
  _request?: Request,
): Promise<AuthUser | Response> {
  const { userId } = await auth();
  if (!userId) return errorJson("AUTH_REQUIRED", "Sign in required.", 401);

  try {
    const user = await resolveAppUser(userId);
    return { id: user.id, clerkUserId: userId };
  } catch (error) {
    console.error("Failed to resolve app user:", error);
    return errorJson(
      "AUTH_USER_SYNC_FAILED",
      "Could not load user profile.",
      500,
    );
  }
}

export function isAuthUser(value: AuthUser | Response): value is AuthUser {
  return typeof value === "object" && "id" in value && "clerkUserId" in value;
}
