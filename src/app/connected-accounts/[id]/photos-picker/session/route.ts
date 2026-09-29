export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  createGooglePhotosPickerSessionHandler,
  deleteGooglePhotosPickerSessionHandler,
  getGooglePhotosPickerSessionHandler,
} from "@/server/handlers/google-photos-picker";
import { handleRoute } from "@/server/http/responses";

export const POST = handleRoute((req, params) =>
  createGooglePhotosPickerSessionHandler(req, undefined, params),
);

/** Poll via ?sessionId= — avoids nested [sessionId] dynamic route issues. */
export const GET = handleRoute((req, params) =>
  getGooglePhotosPickerSessionHandler(req, undefined, params),
);

export const DELETE = handleRoute((req, params) =>
  deleteGooglePhotosPickerSessionHandler(req, undefined, params),
);
