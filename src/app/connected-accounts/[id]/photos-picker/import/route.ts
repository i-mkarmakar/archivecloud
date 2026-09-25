export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { importGooglePhotosPickerMediaHandler } from "@/server/handlers/google-photos-picker";
import { handleRoute } from "@/server/http/responses";

export const POST = handleRoute((req, params) =>
  importGooglePhotosPickerMediaHandler(req, undefined, params),
);
