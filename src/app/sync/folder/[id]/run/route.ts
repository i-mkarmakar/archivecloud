export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { runFolderSyncHandler } from "@/server/handlers/sync";
import { handleRoute } from "@/server/http/responses";

export const POST = handleRoute((req, params) =>
  runFolderSyncHandler(req, undefined, params),
);
