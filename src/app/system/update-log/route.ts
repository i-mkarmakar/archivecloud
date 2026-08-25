export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { systemUpdateLogHandler } from "@/server/handlers/system";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req) => systemUpdateLogHandler(req));
