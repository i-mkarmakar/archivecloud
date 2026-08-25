export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  getGoogleConfigHandler,
  postGoogleConfigHandler,
} from "@/server/handlers/system";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req) => getGoogleConfigHandler(req));
export const POST = handleRoute((req) => postGoogleConfigHandler(req));
