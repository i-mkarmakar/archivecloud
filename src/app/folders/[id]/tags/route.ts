export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  listFolderTagsHandler,
  setFolderTagsHandler,
} from "@/server/handlers/folder-tags";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req, params) =>
  listFolderTagsHandler(req, undefined, params),
);
export const PUT = handleRoute((req, params) =>
  setFolderTagsHandler(req, undefined, params),
);
