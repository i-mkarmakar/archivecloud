export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getTransferJobHandler } from "@/server/handlers/transfers";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req, params) =>
  getTransferJobHandler(req, undefined, params),
);
