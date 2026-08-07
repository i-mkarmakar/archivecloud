import type { Readable } from "node:stream";
import { Readable as NodeReadable } from "node:stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import type {
  ConnectedAccount,
  File,
  S3StorageConfig,
} from "@/generated/prisma/client";
import { prisma } from "../../config/prisma";
import { decryptText } from "../../utils/crypto";

type S3Config = S3StorageConfig;
type FileWithAccount = File & { connectedAccount: ConnectedAccount };
type StreamOptions = { disposition?: "inline" | "attachment" };

function contentDisposition(type: "inline" | "attachment", fileName: string) {
  return `${type}; filename="${fileName.replaceAll('"', "")}"`;
}

export function createS3Client(config: S3Config) {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint ?? undefined,
    forcePathStyle: config.forcePathStyle || Boolean(config.endpoint),
    credentials: {
      accessKeyId: decryptText(config.accessKeyIdEncrypted),
      secretAccessKey: decryptText(config.secretAccessKeyEncrypted),
    },
  });
}

export async function getS3ConfigForAccount(
  accountId: string,
  userId?: string,
) {
  return prisma.s3StorageConfig.findFirstOrThrow({
    where: {
      connectedAccountId: accountId,
      status: "active",
      ...(userId ? { userId } : {}),
    },
  });
}

export async function testS3Connection(config: S3Config) {
  const client = createS3Client(config);
  await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
}

function safeFileName(name: string) {
  return (
    name
      .replace(/[\\/]+/g, "-")
      // biome-ignore lint/suspicious/noControlCharactersInRegex: strip control chars from filenames
      .replace(/[\u0000-\u001f\u007f]+/g, "")
      .slice(0, 180) || "file"
  );
}

export function buildS3ObjectKey(
  config: Pick<S3Config, "prefix">,
  userId: string,
  fileId: string,
  fileName: string,
) {
  return `${config.prefix.replace(/^\/+|\/+$/g, "")}/${userId}/${fileId}/${safeFileName(fileName)}`;
}

export async function uploadS3Object(
  config: S3Config,
  key: string,
  body: NodeJS.ReadableStream,
  mimeType: string,
) {
  const client = createS3Client(config);
  await new Upload({
    client,
    params: {
      Bucket: config.bucket,
      Key: key,
      Body: body as Readable,
      ContentType: mimeType,
    },
  }).done();
}

export async function deleteS3Object(file: FileWithAccount) {
  const config = await getS3ConfigForAccount(file.connectedAccountId);
  const client = createS3Client(config);
  await client.send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: file.providerFileId,
    }),
  );
}

export async function syncS3Quota(accountId: string) {
  const config = await getS3ConfigForAccount(accountId);
  const client = createS3Client(config);
  let usedBytes = 0n;
  let continuationToken: string | undefined;
  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: config.bucket,
        ContinuationToken: continuationToken,
      }),
    );
    for (const object of response.Contents ?? [])
      usedBytes += BigInt(object.Size ?? 0);
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return prisma.storageAccount.upsert({
    where: { connectedAccountId: accountId },
    create: {
      connectedAccountId: accountId,
      totalBytes: config.quotaBytes,
      usedBytes,
      availableBytes:
        config.quotaBytes === null ? null : config.quotaBytes - usedBytes,
      lastSyncedAt: new Date(),
    },
    update: {
      totalBytes: config.quotaBytes,
      usedBytes,
      availableBytes:
        config.quotaBytes === null ? null : config.quotaBytes - usedBytes,
      lastSyncedAt: new Date(),
    },
  });
}

export async function streamS3FileResponse(
  file: FileWithAccount,
  range: string | undefined,
  options: StreamOptions = {},
): Promise<Response> {
  const config = await getS3ConfigForAccount(file.connectedAccountId);
  const client = createS3Client(config);
  const response = await client.send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: file.providerFileId,
      Range: range,
    }),
  );

  const headers = new Headers();
  headers.set("Content-Type", response.ContentType ?? file.mimeType);
  headers.set("Accept-Ranges", "bytes");
  if (options.disposition)
    headers.set(
      "Content-Disposition",
      contentDisposition(options.disposition, file.name),
    );
  if (response.ContentLength !== undefined)
    headers.set("Content-Length", response.ContentLength.toString());
  if (response.ContentRange)
    headers.set("Content-Range", response.ContentRange);

  const body = response.Body as Readable | undefined;
  if (!body)
    return new Response(null, {
      status: response.ContentRange ? 206 : 200,
      headers,
    });

  const webStream = NodeReadable.toWeb(body) as ReadableStream;
  return new Response(webStream, {
    status: response.ContentRange ? 206 : 200,
    headers,
  });
}
