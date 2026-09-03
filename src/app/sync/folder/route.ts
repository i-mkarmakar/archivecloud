export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  createFolderSyncHandler,
  listFolderSyncsHandler,
} from "@/server/handlers/sync";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req) => listFolderSyncsHandler(req));
export const POST = handleRoute((req) => createFolderSyncHandler(req));
