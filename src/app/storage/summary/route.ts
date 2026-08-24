export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getStorageSummaryHandler } from "@/server/handlers/storage";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req) => getStorageSummaryHandler(req));
