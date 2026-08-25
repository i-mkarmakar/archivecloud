export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { systemBackupHandler } from "@/server/handlers/system";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req) => systemBackupHandler(req));
