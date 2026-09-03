export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  deleteFolderSyncHandler,
  patchFolderSyncHandler,
} from "@/server/handlers/sync";
import { handleRoute } from "@/server/http/responses";

export const DELETE = handleRoute((req, params) =>
  deleteFolderSyncHandler(req, undefined, params),
);

export const PATCH = handleRoute((req, params) =>
  patchFolderSyncHandler(req, undefined, params),
);
