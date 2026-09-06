export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  createBillingCheckoutHandler,
  getBillingStatusHandler,
} from "@/server/handlers/billing";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req) => getBillingStatusHandler(req));
export const POST = handleRoute((req) => createBillingCheckoutHandler(req));
