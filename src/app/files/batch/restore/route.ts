export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { batchRestoreFilesHandler } from "@/server/handlers/files";
import { handleRoute } from "@/server/http/responses";

export const POST = handleRoute((req) => batchRestoreFilesHandler(req));
