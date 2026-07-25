export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { listProviderConfigsHandler } from "@/server/handlers/provider-configs";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req) => listProviderConfigsHandler(req));
