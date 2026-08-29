export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { dropboxConnectUrlHandler } from "@/server/handlers/connected-accounts";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req) => dropboxConnectUrlHandler(req));
