export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { systemUpdateHandler } from "@/server/handlers/system";
import { handleRoute } from "@/server/http/responses";

export const POST = handleRoute((req) => systemUpdateHandler(req));
