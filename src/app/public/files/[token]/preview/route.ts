export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { previewPublicFileHandler } from "@/server/handlers/public";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req, params) =>
  previewPublicFileHandler(req, undefined, params),
);
