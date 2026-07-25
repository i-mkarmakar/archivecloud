export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { deleteProviderConfigHandler } from "@/server/handlers/provider-configs";
import { handleRoute } from "@/server/http/responses";

export const DELETE = handleRoute((req, params) =>
  deleteProviderConfigHandler(req, undefined, params),
);
