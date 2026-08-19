export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  createFolderHandler,
  listFoldersHandler,
} from "@/server/handlers/folders";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req) => listFoldersHandler(req));
export const POST = handleRoute((req) => createFolderHandler(req));
