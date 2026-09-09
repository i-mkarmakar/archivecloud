export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { universalSearchHandler } from "@/server/handlers/search";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req) => universalSearchHandler(req));
