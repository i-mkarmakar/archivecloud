import { NextResponse } from "next/server";
import { json } from "@/server/http/responses";

export function oauthConnectStartResponse(request: Request, oauthUrl: string) {
  if (request.headers.get("sec-fetch-mode") === "navigate") {
    return NextResponse.redirect(oauthUrl);
  }
  return json({ url: oauthUrl });
}
