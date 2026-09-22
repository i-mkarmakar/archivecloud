export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { listBillingHistoryHandler } from "@/server/handlers/billing";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req) => listBillingHistoryHandler(req));
