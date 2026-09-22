export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getBillingInvoiceHandler } from "@/server/handlers/billing";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req) => getBillingInvoiceHandler(req));
