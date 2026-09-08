export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  apiV1CreateTransferHandler,
  apiV1ListTransfersHandler,
} from "@/server/handlers/api-v1";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req) => apiV1ListTransfersHandler(req));
export const POST = handleRoute((req) => apiV1CreateTransferHandler(req));
