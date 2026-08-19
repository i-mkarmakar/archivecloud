export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { thumbnailFileHandler } from "@/server/handlers/files";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req, params) =>
  thumbnailFileHandler(req, undefined, params),
);
