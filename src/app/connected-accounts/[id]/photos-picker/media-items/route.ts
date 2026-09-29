export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { listGooglePhotosPickerMediaItemsHandler } from "@/server/handlers/google-photos-picker";
import { handleRoute } from "@/server/http/responses";

/** List via ?sessionId= — avoids nested [sessionId] dynamic route issues. */
export const GET = handleRoute((req, params) =>
  listGooglePhotosPickerMediaItemsHandler(req, undefined, params),
);
