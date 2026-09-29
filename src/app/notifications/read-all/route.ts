export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { markAllNotificationsReadHandler } from "@/server/handlers/notifications";
import { handleRoute } from "@/server/http/responses";

export const POST = handleRoute((req) => markAllNotificationsReadHandler(req));
