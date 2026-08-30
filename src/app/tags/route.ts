export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createTagHandler, listTagsHandler } from "@/server/handlers/tags";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req) => listTagsHandler(req));
export const POST = handleRoute((req) => createTagHandler(req));
