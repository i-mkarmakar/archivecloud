export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  createVirtualFolderHandler,
  listVirtualFoldersHandler,
} from "@/server/handlers/virtual-folders";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req) => listVirtualFoldersHandler(req));
export const POST = handleRoute((req) => createVirtualFolderHandler(req));
