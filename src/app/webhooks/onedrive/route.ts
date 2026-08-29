export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { oneDriveWebhookHandler } from "@/server/handlers/webhooks-onedrive";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req) => oneDriveWebhookHandler(req));
export const POST = handleRoute((req) => oneDriveWebhookHandler(req));
