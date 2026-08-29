export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  dropboxWebhookGetHandler,
  dropboxWebhookPostHandler,
} from "@/server/handlers/webhooks-dropbox";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req) => dropboxWebhookGetHandler(req));
export const POST = handleRoute((req) => dropboxWebhookPostHandler(req));
