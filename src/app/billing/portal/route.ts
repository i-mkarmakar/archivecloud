export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { CustomerPortal } from "@polar-sh/nextjs";
import { headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { env } from "@/server/config/env";
import { prisma } from "@/server/config/prisma";
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

  const historyFallback = new URL("/billing/history", env.APP_URL);
  historyFallback.searchParams.set("portal_error", "1");

  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session?.user?.id) {
      return NextResponse.redirect(new URL("/signin", env.APP_URL));
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { polarCustomerId: true },
    });

    const polarCustomerId = dbUser?.polarCustomerId?.trim() || null;
    const externalCustomerId = session.user.id.trim();

    const handler = polarCustomerId
      ? CustomerPortal({
          accessToken: env.POLAR_ACCESS_TOKEN,
          server: getPolarServer(),
          returnUrl: `${env.APP_URL}/settings`,
          getCustomerId: async () => polarCustomerId,
        })
      : CustomerPortal({
          accessToken: env.POLAR_ACCESS_TOKEN,
          server: getPolarServer(),
          returnUrl: `${env.APP_URL}/settings`,
          getExternalCustomerId: async () => externalCustomerId,
        });

    return await handler(req);
  } catch (error) {
    console.error("[billing/portal]", error);
    return NextResponse.redirect(historyFallback);
  }
};
