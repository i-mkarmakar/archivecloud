export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { pcloudConnectUrlHandler } from "@/server/handlers/provider-connect";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req) => pcloudConnectUrlHandler(req));
