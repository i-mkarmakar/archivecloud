export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cancelScheduledTransferHandler } from "@/server/handlers/automation";
import { handleRoute } from "@/server/http/responses";

export const DELETE = handleRoute((req, params) =>
  cancelScheduledTransferHandler(req, undefined, params),
);

