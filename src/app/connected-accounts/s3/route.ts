export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { connectS3Handler } from "@/server/handlers/connected-accounts";
import { handleRoute } from "@/server/http/responses";

export const POST = handleRoute((req) => connectS3Handler(req));
