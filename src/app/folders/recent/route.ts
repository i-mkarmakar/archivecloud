export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { listRecentFoldersHandler } from "@/server/handlers/folders";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req) => listRecentFoldersHandler(req));
