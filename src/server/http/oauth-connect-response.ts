import { NextResponse } from "next/server";
import { setConnectAliasCookie } from "@/server/http/connect-alias";

export function oauthConnectStartResponse(
  request: Request,
  oauthUrl: string,
  options?: { state?: string; alias?: string | null },
) {
  const navigate = request.headers.get("sec-fetch-mode") === "navigate";
  const response = navigate
    ? NextResponse.redirect(oauthUrl)
    : NextResponse.json({ url: oauthUrl });

  if (options?.state) {
    setConnectAliasCookie(response, options.state, options.alias ?? null);
  }

  return response;
}
