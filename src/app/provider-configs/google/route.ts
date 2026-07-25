export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createGoogleProviderConfigHandler } from "@/server/handlers/provider-configs";
import { handleRoute } from "@/server/http/responses";

export const POST = handleRoute((req) =>
  createGoogleProviderConfigHandler(req),
);
