export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { downloadPublicFileHandler } from "@/server/handlers/public";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req, params) =>
  downloadPublicFileHandler(req, undefined, params),
);
