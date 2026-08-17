export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getPublicFileHandler } from "@/server/handlers/public";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req, params) =>
  getPublicFileHandler(req, undefined, params),
);
