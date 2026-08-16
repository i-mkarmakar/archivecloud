export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  deleteConnectedAccountItemHandler,
  renameConnectedAccountItemHandler,
} from "@/server/handlers/connected-accounts";
import { handleRoute } from "@/server/http/responses";

export const PATCH = handleRoute((req, params) =>
  renameConnectedAccountItemHandler(req, undefined, params),
);

export const DELETE = handleRoute((req, params) =>
  deleteConnectedAccountItemHandler(req, undefined, params),
);
