export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  createInviteHandler,
  listInvitesHandler,
} from "@/server/handlers/invites";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req) => listInvitesHandler(req));
export const POST = handleRoute((req) => createInviteHandler(req));
