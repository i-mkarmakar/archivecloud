export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { CustomerPortal } from "@polar-sh/nextjs";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { env } from "@/server/config/env";
import {
  getPolarServer,
  isPolarConfigured,
} from "@/server/modules/billing/polar";
import { errorJson } from "@/server/http/responses";

export const GET = async (req: NextRequest) => {
  if (!isPolarConfigured() || !env.POLAR_ACCESS_TOKEN) {
    return errorJson(
      "BILLING_NOT_CONFIGURED",
      "Polar billing is not configured.",
      503,
    );
  }

  const handler = CustomerPortal({
    accessToken: env.POLAR_ACCESS_TOKEN,
    server: getPolarServer(),
    returnUrl: `${env.APP_URL}/home`,
    getExternalCustomerId: async () => {
      const session = await auth.api.getSession({
        headers: await headers(),
      });
      if (!session?.user?.id) {
        throw new Error("Sign in required");
      }
      return session.user.id;
    },
  });

  try {
    return await handler(req);
  } catch {
    return errorJson("AUTH_REQUIRED", "Sign in required.", 401);
  }
};
