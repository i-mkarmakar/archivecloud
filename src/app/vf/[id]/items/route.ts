export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  addVirtualFolderItemHandler,
  listVirtualFolderItemsHandler,
} from "@/server/handlers/virtual-folders";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req, params) =>
  listVirtualFolderItemsHandler(req, undefined, params),
);
export const POST = handleRoute((req, params) =>
  addVirtualFolderItemHandler(req, undefined, params),
);
