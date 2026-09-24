import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { errorJson } from "./responses";

export type AuthUser = { id: string };

export async function requireAuthUser(
  _request?: Request,
): Promise<AuthUser | Response> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) {
    return errorJson("AUTH_REQUIRED", "Sign in required.", 401);
  }

  return { id: session.user.id };
}
