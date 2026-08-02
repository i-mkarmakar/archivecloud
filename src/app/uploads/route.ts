export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { handleUploadRequest } from "@/server/handlers/uploads";
import { requireAuthUser } from "@/server/http/auth";
import { handleRoute } from "@/server/http/responses";

export const POST = handleRoute(async (req) => {
  const user = await requireAuthUser(req);
  if (user instanceof Response) return user;
  return handleUploadRequest(req);
});
