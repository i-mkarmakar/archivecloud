export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  getFileHandler,
  trashFileHandler,
  updateFileHandler,
} from "@/server/handlers/files";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req, params) =>
  getFileHandler(req, undefined, params),
);
export const PATCH = handleRoute((req, params) =>
  updateFileHandler(req, undefined, params),
);
export const DELETE = handleRoute((req, params) =>
  trashFileHandler(req, undefined, params),
);
