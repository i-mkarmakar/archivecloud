export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { batchPermanentDeleteFilesHandler } from "@/server/handlers/files";
import { handleRoute } from "@/server/http/responses";

export const DELETE = handleRoute((req) =>
  batchPermanentDeleteFilesHandler(req),
);
