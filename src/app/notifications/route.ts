export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { listNotificationsHandler } from "@/server/handlers/notifications";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req) => listNotificationsHandler(req));
