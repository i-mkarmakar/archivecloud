export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { downloadFileHandler } from "@/server/handlers/files";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req, params) =>
  downloadFileHandler(req, undefined, params),
);
