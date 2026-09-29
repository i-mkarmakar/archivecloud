export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  getNotificationPrefsHandler,
  patchNotificationPrefsHandler,
} from "@/server/handlers/notifications";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req) => getNotificationPrefsHandler(req));
export const PATCH = handleRoute((req) => patchNotificationPrefsHandler(req));
