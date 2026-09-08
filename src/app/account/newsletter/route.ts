export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  getNewsletterHandler,
  patchNewsletterHandler,
} from "@/server/handlers/account";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req) => getNewsletterHandler(req));
export const PATCH = handleRoute((req) => patchNewsletterHandler(req));
