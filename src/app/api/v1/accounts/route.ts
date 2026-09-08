export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { apiV1ListAccountsHandler } from "@/server/handlers/api-v1";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req) => apiV1ListAccountsHandler(req));
