export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { tickFolderSyncsHandler } from "@/server/handlers/sync";
import { handleRoute } from "@/server/http/responses";

export const POST = handleRoute((req) => tickFolderSyncsHandler(req));
