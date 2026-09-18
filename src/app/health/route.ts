export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { handleRoute, json } from "@/server/http/responses";

export const GET = handleRoute(async () => json({ status: "ok" }));
