export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { handleUploadRequest } from "@/server/handlers/uploads";
import { isApiKeyContext, requireApiKeyUser } from "@/server/http/api-key";
import { handleRoute } from "@/server/http/responses";

export const POST = handleRoute(async (req) => {
  const ctx = await requireApiKeyUser(req, "files:upload");
  if (!isApiKeyContext(ctx)) return ctx;
  return handleUploadRequest(req, ctx.user);
});
