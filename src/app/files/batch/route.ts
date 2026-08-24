export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  batchMoveFilesHandler,
  batchTrashFilesHandler,
} from "@/server/handlers/files";
import { handleRoute } from "@/server/http/responses";

export const PATCH = handleRoute((req) => batchMoveFilesHandler(req));
export const DELETE = handleRoute((req) => batchTrashFilesHandler(req));
