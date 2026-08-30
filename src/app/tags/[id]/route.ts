export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { deleteTagHandler } from "@/server/handlers/tags";
import { handleRoute } from "@/server/http/responses";

export const DELETE = handleRoute((req, params) =>
  deleteTagHandler(req, undefined, params),
);
