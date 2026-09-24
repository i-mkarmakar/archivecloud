import { createHmac, timingSafeEqual } from "node:crypto";
import {
  validateEvent,
  WebhookVerificationError,
} from "@polar-sh/sdk/webhooks";

/**
 * Polar webhook signing (https://polar.sh/docs/integrate/webhooks/delivery):
 *
 * - Secrets before 8 Sep 2026 00:00 UTC: Polar HMAC
 *   (UTF-8 bytes of the full `whsec_…` string — what SDK 0.49 `validateEvent` does).
 * - Secrets on/after that instant: Standard Webhooks
 *   (`whsec_` strip + base64-decode).
 *
 * Official SDKs ≥ 1.0.0-alpha.19 try both. We mirror that on 0.49.x.
 */

export function polarWebhookHeaders(headers: Headers): Record<string, string> {
  const read = (...names: string[]) => {
    for (const name of names) {
      const value = headers.get(name);
      if (value) return value;
    }
    return "";
  };

  return {
    "webhook-id": read("webhook-id", "Webhook-Id", "svix-id"),
    "webhook-timestamp": read(
      "webhook-timestamp",
      "Webhook-Timestamp",
      "svix-timestamp",
    ),
    "webhook-signature": read(
      "webhook-signature",
      "Webhook-Signature",
      "svix-signature",
    ),
  };
}

/** Standard Webhooks default tolerance (±5 minutes). */
const WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 300;

function assertRequiredHeaders(headers: Record<string, string>) {
  if (
    !headers["webhook-id"] ||
    !headers["webhook-timestamp"] ||
    !headers["webhook-signature"]
  ) {
    throw new WebhookVerificationError("Missing required headers");
  }
}

function assertWebhookTimestampFresh(timestampHeader: string): void {
  const ts = Number.parseInt(timestampHeader, 10);
  if (!Number.isFinite(ts)) {
    throw new WebhookVerificationError("Invalid webhook timestamp");
  }
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS) {
    throw new WebhookVerificationError(
      now > ts ? "Message timestamp too old" : "Message timestamp too new",
    );
  }
}

function signaturesMatch(expectedBase64: string, headerValue: string): boolean {
  const expected = Buffer.from(expectedBase64);
  for (const part of headerValue.split(" ")) {
    const [version, signature] = part.split(",");
    if (version !== "v1" || !signature) continue;
    const got = Buffer.from(signature);
    if (got.length === expected.length && timingSafeEqual(got, expected)) {
      return true;
    }
  }
  return false;
}

function standardWebhooksKey(secret: string): Buffer {
  const raw = secret.startsWith("whsec_")
    ? secret.slice("whsec_".length)
    : secret;
  return Buffer.from(raw, "base64");
}

function signWithKey(
  key: Buffer,
  msgId: string,
  msgTimestamp: string,
  body: string,
): string {
  return createHmac("sha256", key)
    .update(`${msgId}.${msgTimestamp}.${body}`)
    .digest("base64");
}

function verifyStandardWebhooksSignature(
  body: string,
  headers: Record<string, string>,
  secret: string,
): void {
  assertRequiredHeaders(headers);
  assertWebhookTimestampFresh(headers["webhook-timestamp"]);
  const expected = signWithKey(
    standardWebhooksKey(secret),
    headers["webhook-id"],
    headers["webhook-timestamp"],
    body,
  );
  if (!signaturesMatch(expected, headers["webhook-signature"])) {
    throw new WebhookVerificationError("No matching signature found");
  }
}

function resignForPolarSdk(
  body: string,
  headers: Record<string, string>,
  secret: string,
): Record<string, string> {
  const signature = signWithKey(
    Buffer.from(secret, "utf-8"),
    headers["webhook-id"],
    headers["webhook-timestamp"],
    body,
  );
  return {
    ...headers,
    "webhook-signature": `v1,${signature}`,
  };
}

function parseRawPolarEvent(body: string): {
  type: string;
  data: unknown;
} {
  const parsed = JSON.parse(body) as { type?: unknown; data?: unknown };
  if (typeof parsed?.type !== "string") {
    throw new Error("Polar webhook payload missing type");
  }
  return { type: parsed.type, data: parsed.data };
}

export function verifyAndParsePolarWebhook(
  body: string,
  headers: Record<string, string>,
  secret: string,
): { type: string; data: unknown } {
  try {
    // Pre-2026-09-08 secrets (Polar HMAC) via current SDK
    return validateEvent(body, headers, secret) as {
      type: string;
      data: unknown;
    };
  } catch (sdkError) {
    if (!(sdkError instanceof WebhookVerificationError)) {
      // Polar HMAC signature verified, but SDK schema rejected the payload
      // (API version drift). Signature is trusted — use raw JSON.
      console.warn(
        "Polar webhook Polar-HMAC signature OK; SDK schema parse failed — using raw JSON",
        sdkError instanceof Error ? sdkError.message.slice(0, 200) : sdkError,
      );
      return parseRawPolarEvent(body);
    }

    // Post-2026-09-08 secrets (Standard Webhooks)
    try {
      verifyStandardWebhooksSignature(body, headers, secret);
    } catch (specVerifyError) {
      console.error("Polar webhook verification failed", {
        sdkMessage:
          sdkError instanceof Error ? sdkError.message : String(sdkError),
        specMessage:
          specVerifyError instanceof Error
            ? specVerifyError.message
            : String(specVerifyError),
        hasId: Boolean(headers["webhook-id"]),
        hasTimestamp: Boolean(headers["webhook-timestamp"]),
        hasSignature: Boolean(headers["webhook-signature"]),
        bodyBytes: body.length,
        secretLen: secret.length,
      });
      throw sdkError;
    }

    try {
      // Re-sign with Polar HMAC so SDK schema parsing can run
      return validateEvent(
        body,
        resignForPolarSdk(body, headers, secret),
        secret,
      ) as { type: string; data: unknown };
    } catch (parseError) {
      // Spec HMAC + timestamp already verified above. Only fall back to raw
      // JSON on schema/parse drift — never on WebhookVerificationError
      // (e.g. timestamp reject from the SDK path after resign).
      if (parseError instanceof WebhookVerificationError) {
        throw parseError;
      }
      console.warn(
        "Polar webhook Spec signature OK; SDK schema parse failed — using raw JSON",
        parseError instanceof Error
          ? parseError.message.slice(0, 200)
          : parseError,
      );
      return parseRawPolarEvent(body);
    }
  }
}

export { WebhookVerificationError };
