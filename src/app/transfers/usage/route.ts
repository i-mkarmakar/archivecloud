export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getTransferUsageHandler } from "@/server/handlers/transfers";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req) => getTransferUsageHandler(req));
