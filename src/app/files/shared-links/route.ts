export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { listSharedLinksHandler } from "@/server/handlers/files";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req) => listSharedLinksHandler(req));
