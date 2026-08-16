export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createConnectedAccountFolderHandler } from "@/server/handlers/connected-accounts";
import { handleRoute } from "@/server/http/responses";

export const POST = handleRoute((req, params) =>
  createConnectedAccountFolderHandler(req, undefined, params),
);
