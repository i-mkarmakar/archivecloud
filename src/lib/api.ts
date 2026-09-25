export const API_URL = "";

type ApiOptions = RequestInit & { skipAuth?: boolean };

export class ApiRequestError extends Error {
  readonly code: string | undefined;
  readonly status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

export function isAbortError(error: unknown) {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

export function isNetworkError(error: unknown) {
  if (
    error instanceof TypeError &&
    /failed to fetch|networkerror|load failed/i.test(error.message)
  ) {
    return true;
  }
  return (
    error instanceof Error &&
    error.message ===
      "Network request failed. Check your connection and try again."
  );
}

export async function apiFetch<T>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      credentials: "same-origin",
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (isNetworkError(error)) {
      throw new Error(
        "Network request failed. Check your connection and try again.",
      );
    }
    throw error;
  }

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText, code: undefined }));
    throw new ApiRequestError(
      typeof error.message === "string" && error.message
        ? error.message
        : "Request failed",
      response.status,
      typeof error.code === "string" ? error.code : undefined,
    );
  }

  return response.json() as Promise<T>;
}

export function formatBytes(
  input: string | number | bigint | null | undefined,
) {
  if (input === null || input === undefined) return "--";
  const bytes = Number(input);
  if (!Number.isFinite(bytes)) return "--";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
