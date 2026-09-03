export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { googleDriveWebhookHandler } from "@/server/handlers/webhooks-google";
import { handleRoute } from "@/server/http/responses";

export const POST = handleRoute((req) => googleDriveWebhookHandler(req));
