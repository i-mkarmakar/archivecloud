export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { shareFileHandler, unshareFileHandler } from "@/server/handlers/files";
import { handleRoute } from "@/server/http/responses";

export const POST = handleRoute((req, params) =>
  shareFileHandler(req, undefined, params),
);
export const DELETE = handleRoute((req, params) =>
  unshareFileHandler(req, undefined, params),
);
