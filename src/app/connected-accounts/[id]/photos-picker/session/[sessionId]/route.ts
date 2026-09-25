export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  deleteGooglePhotosPickerSessionHandler,
  getGooglePhotosPickerSessionHandler,
} from "@/server/handlers/google-photos-picker";
import { handleRoute } from "@/server/http/responses";

export const GET = handleRoute((req, params) =>
  getGooglePhotosPickerSessionHandler(req, undefined, params),
);

export const DELETE = handleRoute((req, params) =>
  deleteGooglePhotosPickerSessionHandler(req, undefined, params),
);
