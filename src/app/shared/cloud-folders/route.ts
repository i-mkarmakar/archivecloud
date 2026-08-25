import { listCloudSharedFoldersHandler } from "@/server/handlers/shared-cloud";
import { handleRoute } from "@/server/http/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handleRoute((req) => listCloudSharedFoldersHandler(req));
