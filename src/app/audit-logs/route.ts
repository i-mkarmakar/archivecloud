export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { listAuditLogsHandler } from "@/server/handlers/audit-logs";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req) => listAuditLogsHandler(req));
