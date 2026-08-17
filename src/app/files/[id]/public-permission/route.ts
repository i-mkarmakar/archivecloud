export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { publicPermissionHandler } from "@/server/handlers/files";
import { handleRoute } from "@/server/http/responses";

export const POST = handleRoute((req, params) =>
  publicPermissionHandler(req, undefined, params),
);
