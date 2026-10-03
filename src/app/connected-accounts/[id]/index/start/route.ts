export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { startAccountIndexHandler } from "@/server/handlers/connected-accounts";
import { handleRoute } from "@/server/http/responses";

export const POST = handleRoute((req, params) =>
  startAccountIndexHandler(req, undefined, params),
);
