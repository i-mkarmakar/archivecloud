export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  createTransferCopyHandler,
  listTransferJobsHandler,
} from "@/server/handlers/transfers";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req) => listTransferJobsHandler(req));
export const POST = handleRoute((req) => createTransferCopyHandler(req));
