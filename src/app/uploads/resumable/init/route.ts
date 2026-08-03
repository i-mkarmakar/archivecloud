export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { resumableInitHandler } from "@/server/handlers/uploads";
import { handleRoute } from "@/server/http/responses";

export const POST = handleRoute((req) => resumableInitHandler(req));
