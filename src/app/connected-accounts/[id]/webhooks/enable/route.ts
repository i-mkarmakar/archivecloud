export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { enableAccountWebhooksHandler } from "@/server/handlers/webhooks-enable";
import { handleRoute } from "@/server/http/responses";

export const POST = handleRoute((req, params) =>
  enableAccountWebhooksHandler(req, undefined, params),
);
