import { errorJson } from "@/server/http/responses";

export type PublicStreamErrorKind =
  | "rate_limited"
  | "unavailable"
  | "not_found"
  | "failed";

const CLIENT_MESSAGES: Record<PublicStreamErrorKind, string> = {
  rate_limited:
    "This file is temporarily unavailable due to rate limits. Try again later.",
  unavailable: "This file is temporarily unavailable. Try again later.",
  not_found: "File not found.",
  failed: "Failed to load this file.",
};

const STATUS: Record<PublicStreamErrorKind, number> = {
  rate_limited: 429,
  unavailable: 503,
  not_found: 404,
  failed: 502,
};

const CODE: Record<PublicStreamErrorKind, string> = {
  rate_limited: "FILE_STREAM_RATE_LIMITED",
  unavailable: "FILE_STREAM_UNAVAILABLE",
  not_found: "FILE_STREAM_NOT_FOUND",
  failed: "FILE_STREAM_FAILED",
};

/** Map provider/status text to a generic client-safe kind. Never expose provider bodies. */
export function classifyPublicStreamError(
  error: unknown,
  httpStatus?: number,
): PublicStreamErrorKind {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const combined = `${httpStatus ?? ""} ${message}`;

  if (
    httpStatus === 429 ||
    /downloadQuotaExceeded|userRateLimitExceeded|too_many_requests|rate.?limit|429/i.test(
      combined,
    )
  ) {
    return "rate_limited";
  }

  if (
    httpStatus === 404 ||
    /\b404\b|not[_ ]found|file not found|does not exist/i.test(combined)
  ) {
    return "not_found";
  }

  if (
    httpStatus === 503 ||
    httpStatus === 502 ||
    /\b503\b|\b502\b|unavailable|backendError|service.?unavailable/i.test(
      combined,
    )
  ) {
    return "unavailable";
  }

  // Google often returns 403 for quota / rate limits.
  if (
    httpStatus === 403 ||
    /downloadQuotaExceeded|userRateLimitExceeded/i.test(message)
  ) {
    if (
      /downloadQuotaExceeded|userRateLimitExceeded|rate.?limit/i.test(message)
    ) {
      return "rate_limited";
    }
    return "failed";
  }

  return "failed";
}

export function publicStreamErrorResponse(
  error: unknown,
  options?: { httpStatus?: number; logLabel?: string },
): Response {
  const kind = classifyPublicStreamError(error, options?.httpStatus);
  console.error(
    options?.logLabel ?? "Public/preview file stream failed:",
    error,
  );
  return errorJson(CODE[kind], CLIENT_MESSAGES[kind], STATUS[kind], {
    headers: kind === "rate_limited" ? { "Retry-After": "60" } : undefined,
  });
}
