export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { retryTransferJobHandler } from "@/server/handlers/transfers";
import { handleRoute } from "@/server/http/responses";

export const POST = handleRoute((req, params) =>
  retryTransferJobHandler(req, undefined, params),
);
