export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { reportAbuseHandler } from "@/server/handlers/report-abuse";
import { handleRoute } from "@/server/http/responses";

export const POST = handleRoute((req) => reportAbuseHandler(req));
