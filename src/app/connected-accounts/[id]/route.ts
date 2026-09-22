export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  disconnectAccountHandler,
  updateConnectedAccountHandler,
} from "@/server/handlers/connected-accounts";
import { handleRoute } from "@/server/http/responses";

export const PATCH = handleRoute((req, params) =>
  updateConnectedAccountHandler(req, undefined, params),
);

export const DELETE = handleRoute((req, params) =>
  disconnectAccountHandler(req, undefined, params),
);
