export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { resumableStatusHandler } from "@/server/handlers/uploads";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req, params) =>
  resumableStatusHandler(req, undefined, params),
);
