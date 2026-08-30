export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { connectICloudHandler } from "@/server/handlers/provider-connect";
import { handleRoute } from "@/server/http/responses";

export const POST = handleRoute((req) => connectICloudHandler(req));
