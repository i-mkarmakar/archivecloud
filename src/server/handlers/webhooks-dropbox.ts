import { z } from "zod";
import { errorJson, json } from "@/server/http/responses";
import {
  handleDropboxAccountNotifications,
  isDropboxWebhookConfigured,
  verifyDropboxSignature,
} from "@/server/modules/webhooks/dropbox-notify";

const dropboxWebhookBodySchema = z.object({
  list_folder: z
    .object({
      accounts: z.array(z.string()).optional(),
    })
    .optional(),
  delta: z
    .object({
      users: z.array(z.union([z.string(), z.number()])).optional(),
    })
    .optional(),
});

export async function dropboxWebhookGetHandler(request: Request) {
  const url = new URL(request.url);
  const challenge = z
    .string()
    .min(1)
    .safeParse(url.searchParams.get("challenge"));
  if (!challenge.success) {
    return errorJson("VALIDATION_ERROR", "Missing challenge.", 400);
  }
  return new Response(challenge.data, {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function dropboxWebhookPostHandler(request: Request) {
  if (!isDropboxWebhookConfigured()) {
    return errorJson(
      "WEBHOOK_NOT_CONFIGURED",
      "Set DROPBOX_CLIENT_SECRET to enable Dropbox webhooks.",
      503,
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-dropbox-signature");

  if (!verifyDropboxSignature(rawBody, signature)) {
    return errorJson("UNAUTHORIZED", "Invalid Dropbox signature.", 403);
  }

  let jsonBody: unknown;
  try {
    jsonBody = JSON.parse(rawBody) as unknown;
  } catch {
    return errorJson("VALIDATION_ERROR", "Invalid JSON body.", 400);
  }

  const parsed = dropboxWebhookBodySchema.safeParse(jsonBody);
  if (!parsed.success) {
    return errorJson("VALIDATION_ERROR", "Invalid webhook payload.", 400);
  }

  const accountIds = [
    ...(parsed.data.list_folder?.accounts ?? []),
    ...(parsed.data.delta?.users ?? []).map(String),
  ];

  const result = await handleDropboxAccountNotifications(accountIds);
  return json({ ok: true, matched: result.matched });
}
