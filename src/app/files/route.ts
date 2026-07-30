export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { listFilesHandler } from "@/server/handlers/files";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req) => listFilesHandler(req));
