export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { listGooglePhotosPickerMediaItemsHandler } from "@/server/handlers/google-photos-picker";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req, params) =>
  listGooglePhotosPickerMediaItemsHandler(req, undefined, params),
);
