import { ZodError } from "zod";

export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function errorJson(code: string, message: string, status: number) {
  return Response.json({ code, message }, { status });
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
        return errorJson("VALIDATION_ERROR", error.message, 400);
      }
      console.error(error);
      return errorJson(
        "INTERNAL_SERVER_ERROR",
        error instanceof Error ? error.message : "Internal server error",
        500,
      );
    }
  };
}
