export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { previewFileByTokenHandler } from "@/server/handlers/files";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req, params) =>
  previewFileByTokenHandler(req, undefined, params),
);
