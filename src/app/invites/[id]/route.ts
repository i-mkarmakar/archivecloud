export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { deleteInviteHandler } from "@/server/handlers/invites";
import { handleRoute } from "@/server/http/responses";

export const DELETE = handleRoute((req, params) =>
  deleteInviteHandler(req, undefined, params),
);
