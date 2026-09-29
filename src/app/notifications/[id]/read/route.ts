export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { markNotificationReadHandler } from "@/server/handlers/notifications";
import { handleRoute } from "@/server/http/responses";

export const PATCH = handleRoute((req, params) =>
  markNotificationReadHandler(req, params),
);
