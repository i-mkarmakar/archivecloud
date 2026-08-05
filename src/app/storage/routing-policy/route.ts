export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  getRoutingPolicyHandler,
  patchRoutingPolicyHandler,
} from "@/server/handlers/storage";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req) => getRoutingPolicyHandler(req));
export const PATCH = handleRoute((req) => patchRoutingPolicyHandler(req));
