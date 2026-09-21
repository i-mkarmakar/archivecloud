export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { tickAutomationHandler } from "@/server/handlers/automation";
import { handleRoute } from "@/server/http/responses";

export const POST = handleRoute((req) => tickAutomationHandler(req));
