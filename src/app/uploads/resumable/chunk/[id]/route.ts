export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { resumableChunkHandler } from "@/server/handlers/uploads";
import { handleRoute } from "@/server/http/responses";

export const PUT = handleRoute((req, params) =>
  resumableChunkHandler(req, undefined, params),
);
