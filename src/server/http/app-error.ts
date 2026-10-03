/**
 * Handler-thrown error that handleRoute maps to a controlled public JSON body.
 * Use only with safe, user-facing messages (never raw provider/DB text).
 */
export class AppHttpError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "AppHttpError";
    this.code = code;
    this.status = status;
  }
}

export function isAppHttpError(error: unknown): error is AppHttpError {
  return error instanceof AppHttpError;
}
