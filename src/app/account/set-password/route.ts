export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { setPasswordHandler } from "@/server/handlers/account";
import { handleRoute } from "@/server/http/responses";

export const POST = handleRoute((req) => setPasswordHandler(req));
