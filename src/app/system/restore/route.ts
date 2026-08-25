export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { systemRestoreHandler } from "@/server/handlers/system";
import { handleRoute } from "@/server/http/responses";

export const POST = handleRoute((req) => systemRestoreHandler(req));
