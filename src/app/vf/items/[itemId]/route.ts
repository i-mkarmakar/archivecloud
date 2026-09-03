export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { removeVirtualFolderItemHandler } from "@/server/handlers/virtual-folders";
import { handleRoute } from "@/server/http/responses";

export const DELETE = handleRoute((req, params) =>
  removeVirtualFolderItemHandler(req, undefined, params),
);
