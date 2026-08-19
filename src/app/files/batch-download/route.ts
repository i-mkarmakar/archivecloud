export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { batchDownloadHandler } from "@/server/handlers/files";
import { handleRoute } from "@/server/http/responses";

export const POST = handleRoute((req) => batchDownloadHandler(req));
