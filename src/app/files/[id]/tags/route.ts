export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  listFileTagsHandler,
  setFileTagsHandler,
} from "@/server/handlers/tags";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req, params) =>
  listFileTagsHandler(req, undefined, params),
);
export const PUT = handleRoute((req, params) =>
  setFileTagsHandler(req, undefined, params),
);
