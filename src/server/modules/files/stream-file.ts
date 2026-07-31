import type { ConnectedAccount, File } from "@/generated/prisma/client";
import { streamS3FileResponse } from "../s3/s3.service";
import { streamGoogleFileResponse } from "./stream-google-file";

type FileWithAccount = File & { connectedAccount: ConnectedAccount };
type StreamOptions = { disposition?: "inline" | "attachment" };

export function streamProviderFileResponse(
  file: FileWithAccount,
  range: string | undefined,
  options: StreamOptions = {},
): Promise<Response> {
  if (file.provider === "s3") return streamS3FileResponse(file, range, options);
  return streamGoogleFileResponse(file, range, options);
}
