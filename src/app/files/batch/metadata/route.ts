export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { batchUpdateFileMetadataHandler } from "@/server/handlers/files";
import { handleRoute } from "@/server/http/responses";

export const PATCH = handleRoute((req) => batchUpdateFileMetadataHandler(req));
