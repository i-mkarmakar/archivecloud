import {
  handleDropboxAccountNotifications,
  verifyDropboxSignature,
} from "@/server/modules/webhooks/dropbox-notify";
import { errorJson, json } from "@/server/http/responses";

export async function dropboxWebhookGetHandler(request: Request) {
  const url = new URL(request.url);
  const challenge = url.searchParams.get("challenge");
  if (!challenge) {
    return errorJson("VALIDATION_ERROR", "Missing challenge.", 400);
  }
  return new Response(challenge, {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function dropboxWebhookPostHandler(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-dropbox-signature");

  if (!verifyDropboxSignature(rawBody, signature)) {
    return errorJson("UNAUTHORIZED", "Invalid Dropbox signature.", 403);
  }

  let parsed: {
    list_folder?: { accounts?: string[] };
    delta?: { users?: Array<string | number> };
  };
  try {
    parsed = JSON.parse(rawBody) as typeof parsed;
  } catch {
    return errorJson("VALIDATION_ERROR", "Invalid JSON body.", 400);
  }

  const accountIds = [
    ...(parsed.list_folder?.accounts ?? []),
    ...(parsed.delta?.users ?? []).map(String),
  ];

  const result = await handleDropboxAccountNotifications(accountIds);
  return json({ ok: true, matched: result.matched });
}
