export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  createScheduledTransferHandler,
  listScheduledTransfersHandler,
} from "@/server/handlers/automation";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req) => listScheduledTransfersHandler(req));
export const POST = handleRoute((req) => createScheduledTransferHandler(req));
