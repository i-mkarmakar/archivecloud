export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { billingPortalHandler } from "@/server/handlers/billing";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req) =>
  billingPortalHandler(req as NextRequest),
);
