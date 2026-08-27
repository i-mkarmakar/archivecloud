export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  createApiKeyHandler,
  listApiKeysHandler,
} from "@/server/handlers/api-keys";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req) => listApiKeysHandler(req));
export const POST = handleRoute((req) => createApiKeyHandler(req));
