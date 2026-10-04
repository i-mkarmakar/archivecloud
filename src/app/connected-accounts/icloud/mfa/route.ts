import { completeICloudMfaHandler } from "@/server/handlers/provider-connect";
import { handleRoute } from "@/server/http/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handleRoute((req) => completeICloudMfaHandler(req));
