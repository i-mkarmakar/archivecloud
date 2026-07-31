export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getViewUrlHandler } from "@/server/handlers/files";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req, params) =>
  getViewUrlHandler(req, undefined, params),
);
