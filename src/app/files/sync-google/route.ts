export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { syncGoogleFilesHandler } from "@/server/handlers/files";
import { handleRoute } from "@/server/http/responses";

export const POST = handleRoute((req) => syncGoogleFilesHandler(req));
