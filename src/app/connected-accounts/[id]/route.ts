export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { disconnectAccountHandler } from "@/server/handlers/connected-accounts";
import { handleRoute } from "@/server/http/responses";

export const DELETE = handleRoute((req, params) =>
  disconnectAccountHandler(req, undefined, params),
);
