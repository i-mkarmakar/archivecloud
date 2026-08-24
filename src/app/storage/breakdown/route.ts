export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getStorageBreakdownHandler } from "@/server/handlers/storage";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req) => getStorageBreakdownHandler(req));
