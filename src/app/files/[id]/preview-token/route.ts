export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createPreviewTokenHandler } from "@/server/handlers/files";
import { handleRoute } from "@/server/http/responses";

export const POST = handleRoute((req, params) =>
  createPreviewTokenHandler(req, undefined, params),
);
