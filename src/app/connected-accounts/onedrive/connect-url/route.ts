export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { onedriveConnectUrlHandler } from "@/server/handlers/connected-accounts";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req) => onedriveConnectUrlHandler(req));
