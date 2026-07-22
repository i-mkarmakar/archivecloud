export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getAccountHandler } from "@/server/handlers/account";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req) => getAccountHandler(req));
