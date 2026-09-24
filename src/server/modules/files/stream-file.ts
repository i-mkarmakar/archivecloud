import "server-only";

import type { ConnectedAccount, File } from "@/generated/prisma/client";
import { streamGoogleFileResponse } from "./stream-google-file";

type FileWithAccount = File & { connectedAccount: ConnectedAccount };
type StreamOptions = { disposition?: "inline" | "attachment" };

export function streamProviderFileResponse(
  file: FileWithAccount,
  range: string | undefined,
  options: StreamOptions = {},
): Promise<Response> {
  return streamGoogleFileResponse(file, range, options);
}
