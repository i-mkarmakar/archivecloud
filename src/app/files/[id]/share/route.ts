export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  getFileShareHandler,
  setFileShareEnabledHandler,
  shareFileHandler,
  unshareFileHandler,
} from "@/server/handlers/files";
import { handleRoute } from "@/server/http/responses";

/** Public-link CRUD for catalog + linked (`linked:accountId:providerFileId`) files. */
export const GET = handleRoute((req, params) =>
  getFileShareHandler(req, undefined, params),
);
export const POST = handleRoute((req, params) =>
  shareFileHandler(req, undefined, params),
);
export const PATCH = handleRoute((req, params) =>
  setFileShareEnabledHandler(req, undefined, params),
);
export const DELETE = handleRoute((req, params) =>
  unshareFileHandler(req, undefined, params),
);
