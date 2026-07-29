export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  deleteFolderHandler,
  updateFolderHandler,
} from "@/server/handlers/folders";
import { handleRoute } from "@/server/http/responses";

export const PATCH = handleRoute((req, params) =>
  updateFolderHandler(req, undefined, params),
);
export const DELETE = handleRoute((req, params) =>
  deleteFolderHandler(req, undefined, params),
);
