export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { revokeApiKeyHandler } from "@/server/handlers/api-keys";
import { handleRoute } from "@/server/http/responses";

export const DELETE = handleRoute((req, params) =>
  revokeApiKeyHandler(req, undefined, params),
);
