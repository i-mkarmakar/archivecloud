import { ZodError } from "zod";
import { isAppHttpError } from "@/server/http/app-error";

/** Stable public copy for unexpected server failures. */
export const PUBLIC_INTERNAL_ERROR_MESSAGE =
  "Something went wrong. Please try again later.";

/** Stable public copy for uncaught Zod validation failures. */
export const PUBLIC_VALIDATION_ERROR_MESSAGE = "Invalid request.";

export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

/**
 * Explicit, handler-controlled public API error.
 * Callers must pass a safe user-facing message — never raw third-party /
 * Prisma / OAuth exception text unless it has already been sanitized.
 */
export function errorJson(
  code: string,
  message: string,
  status: number,
  init?: { headers?: HeadersInit },
) {
  return Response.json({ code, message }, { status, headers: init?.headers });
}

function requestPath(request: Request): string {
  try {
    return new URL(request.url).pathname;
  } catch {
    return "(unknown)";
  }
}

function logRouteError(request: Request, error: unknown) {
  const path = requestPath(request);
  if (error instanceof Error) {
    console.error("[handleRoute]", {
      method: request.method,
      path,
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    return;
  }
  console.error("[handleRoute]", {
    method: request.method,
    path,
    error,
  });
}

export function handleRoute(
  handler: (
    request: Request,
    params: Record<string, string>,
  ) => Promise<Response>,
) {
  return async (
    request: Request,
    context?: { params: Promise<Record<string, string>> },
  ) => {
    try {
      const params = context?.params ? await context.params : {};
      return await handler(request, params);
    } catch (error) {
      if (error instanceof ZodError) {
        logRouteError(request, error);
        return errorJson(
          "VALIDATION_ERROR",
          PUBLIC_VALIDATION_ERROR_MESSAGE,
          400,
        );
      }
      if (isAppHttpError(error)) {
        return errorJson(error.code, error.message, error.status);
      }
      logRouteError(request, error);
      return errorJson(
        "INTERNAL_SERVER_ERROR",
        PUBLIC_INTERNAL_ERROR_MESSAGE,
        500,
      );
    }
  };
}
