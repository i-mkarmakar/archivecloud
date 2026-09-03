export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  deleteVirtualFolderHandler,
  getVirtualFolderHandler,
  updateVirtualFolderHandler,
} from "@/server/handlers/virtual-folders";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req, params) =>
  getVirtualFolderHandler(req, undefined, params),
);

export const PATCH = handleRoute((req, params) =>
  updateVirtualFolderHandler(req, undefined, params),
);

export const DELETE = handleRoute((req, params) =>
  deleteVirtualFolderHandler(req, undefined, params),
);
