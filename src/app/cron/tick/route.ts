export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cronTickHandler } from "@/server/handlers/cron";
import { handleRoute } from "@/server/http/responses";

export const POST = handleRoute((req) => cronTickHandler(req));
export const GET = handleRoute((req) => cronTickHandler(req));
