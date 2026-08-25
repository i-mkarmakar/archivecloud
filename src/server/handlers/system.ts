import { exec, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import Busboy from "busboy";
import { prisma } from "@/server/config/prisma";
import { requireAuthUser } from "@/server/http/auth";
import { errorJson, json } from "@/server/http/responses";
import { requireDeveloperMode } from "@/server/lib/require-developer-mode";
import { decryptText, encryptText } from "@/server/utils/crypto";

function getDefaultRedirectUri(request: Request) {
  const url = new URL(request.url);
  return `${url.origin}/connected-accounts/google/callback`;
}

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL is not set.");
  return url;
}

function runCommand(
  command: string,
  args: string[],
  input?: Readable,
): Promise<{ stdout: Buffer; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: process.env });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout?.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr?.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      const stderr = Buffer.concat(stderrChunks).toString("utf8").trim();
      if (code === 0) {
        resolve({ stdout: Buffer.concat(stdoutChunks), stderr });
        return;
      }
      reject(new Error(stderr || `${command} exited with code ${code}`));
    });

    if (input) {
      input.pipe(child.stdin!);
      input.on("error", (error) => {
        child.stdin?.destroy(error);
      });
    } else {
      child.stdin?.end();
    }
  });
}

export async function systemUpdateHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const denied = await requireDeveloperMode(user);
  if (denied) return denied;

  const projectRoot = path.resolve(process.cwd(), "..");
  const updateScript = path.join(projectRoot, "update.sh");

  return new Promise<Response>((resolve) => {
    exec("git --version", (gitError) => {
      if (gitError) {
        resolve(
          errorJson(
            "GIT_NOT_FOUND",
            "Git is not installed or not available on PATH. Install Git, then pull the latest code and restart the app process.",
            400,
          ),
        );
        return;
      }

      if (fs.existsSync(updateScript)) {
        try {
          const logFile = path.join(projectRoot, "update.log");
          fs.writeFileSync(logFile, "Initiating update...\n");

          const child = spawn("bash", ["update.sh"], {
            cwd: projectRoot,
            detached: true,
            stdio: "ignore",
          });
          child.unref();

          resolve(
            json({
              status: "success",
              message:
                "System update initiated. The update script is running in the background. Please wait ~1 minute and refresh the page.",
            }),
          );
        } catch (_err: unknown) {
          resolve(
            errorJson("UPDATE_FAILED", "Failed to start update script.", 500),
          );
        }
        return;
      }

      exec("git pull", { cwd: projectRoot }, (error, stdout, stderr) => {
        if (error) {
          console.error("System update failed:", error);
          resolve(
            json(
              {
                code: "UPDATE_FAILED",
                message:
                  "Failed to run git pull. Make sure git is installed and configured.",
                error: error.message,
                stderr,
              },
              500,
            ),
          );
          return;
        }

        console.log("System update stdout:", stdout);
        if (stderr) {
          console.warn("System update stderr:", stderr);
        }

        resolve(
          json({
            status: "success",
            message:
              "System code updated successfully. Dev servers will auto-restart.",
            stdout,
            stderr,
          }),
        );
      });
    });
  });
}

export async function systemUpdateLogHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const denied = await requireDeveloperMode(user);
  if (denied) return denied;

  const projectRoot = path.resolve(process.cwd(), "..");
  const logFile = path.join(projectRoot, "update.log");

  if (!fs.existsSync(logFile)) {
    return json({ log: "No update history found." });
  }

  try {
    const logContent = fs.readFileSync(logFile, "utf8");
    return json({ log: logContent });
  } catch (error: unknown) {
    return errorJson(
      "READ_LOG_FAILED",
      error instanceof Error
        ? error.message
        : "Failed to read update log file.",
      500,
    );
  }
}

export async function getGoogleConfigHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const denied = await requireDeveloperMode(user);
  if (denied) return denied;

  const config = await prisma.providerConfig.findFirst({
    where: { userId: null, provider: "google_drive", status: "active" },
    orderBy: { createdAt: "desc" },
  });

  const defaultRedirect = getDefaultRedirectUri(request);

  if (!config) {
    return json({ exists: false, defaultRedirectUri: defaultRedirect });
  }

  let clientId = "";
  try {
    clientId = decryptText(config.clientIdEncrypted);
  } catch {
    clientId = "";
  }

  return json({
    exists: true,
    clientId,
    redirectUri: config.redirectUri,
    hasSecret: !!config.clientSecretEncrypted,
    defaultRedirectUri: defaultRedirect,
  });
}

export async function postGoogleConfigHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const denied = await requireDeveloperMode(user);
  if (denied) return denied;

  const body = (await request.json()) as {
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
  };
  const { clientId, clientSecret, redirectUri } = body;

  if (!clientId) {
    return errorJson("BAD_REQUEST", "Client ID is required.", 400);
  }

  const defaultRedirect = getDefaultRedirectUri(request);
  const finalRedirectUri = redirectUri || defaultRedirect;

  const scopes = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ];

  await prisma.providerConfig.updateMany({
    where: { userId: null, provider: "google_drive", status: "active" },
    data: { status: "disabled" },
  });

  let finalSecret = clientSecret;
  if (!finalSecret) {
    const oldConfig = await prisma.providerConfig.findFirst({
      where: { userId: null, provider: "google_drive", status: "disabled" },
      orderBy: { createdAt: "desc" },
    });
    if (oldConfig) {
      try {
        finalSecret = decryptText(oldConfig.clientSecretEncrypted);
      } catch {
        // ignore
      }
    }
  }

  if (!finalSecret) {
    return errorJson(
      "BAD_REQUEST",
      "Client Secret is required for first-time setup.",
      400,
    );
  }

  const config = await prisma.providerConfig.create({
    data: {
      userId: null,
      provider: "google_drive",
      clientIdEncrypted: encryptText(clientId),
      clientSecretEncrypted: encryptText(finalSecret),
      redirectUri: finalRedirectUri,
      scopes,
      status: "active",
    },
  });

  return json(
    {
      status: "success",
      message: "Global Google OAuth configuration updated successfully.",
      id: config.id,
    },
    201,
  );
}

export async function systemBackupHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const denied = await requireDeveloperMode(user);
  if (denied) return denied;

  try {
    const databaseUrl = getDatabaseUrl();
    const { stdout } = await runCommand("pg_dump", [
      "--dbname",
      databaseUrl,
      "--format=plain",
      "--no-owner",
      "--no-acl",
    ]);

    return new Response(new Uint8Array(stdout), {
      headers: {
        "Content-Disposition": "attachment; filename=archivecloud-backup.sql",
        "Content-Type": "application/sql; charset=utf-8",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create database backup.";
    return errorJson("BACKUP_FAILED", message, 500);
  }
}

export async function systemRestoreHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const denied = await requireDeveloperMode(user);
  if (denied) return denied;

  const contentType = request.headers.get("content-type");
  if (!contentType?.includes("multipart/form-data")) {
    return errorJson("BAD_REQUEST", "multipart/form-data required.", 400);
  }

  if (!request.body) {
    return errorJson("BAD_REQUEST", "No file uploaded.", 400);
  }

  return new Promise<Response>((resolve) => {
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const busboy = Busboy({ headers, limits: { files: 1 } });
    let fileReceived = false;
    let resolved = false;

    const finish = (response: Response) => {
      if (!resolved) {
        resolved = true;
        resolve(response);
      }
    };

    busboy.on("file", (_name, fileStream) => {
      fileReceived = true;
      const databaseUrl = getDatabaseUrl();
      const sqlStream = fileStream as Readable;

      runCommand(
        "psql",
        ["--dbname", databaseUrl, "--set", "ON_ERROR_STOP=on"],
        sqlStream,
      )
        .then(async () => {
          try {
            await prisma.$disconnect();
            finish(
              json({
                status: "success",
                message:
                  "Database restored successfully. Server will restart in 2 seconds.",
              }),
            );
            setTimeout(() => {
              console.log(
                "Database restored. Exiting to allow process manager restart.",
              );
              process.exit(0);
            }, 2000);
          } catch (err: unknown) {
            console.error("Failed to finalize database restore:", err);
            finish(
              errorJson(
                "RESTORE_FAILED",
                err instanceof Error
                  ? err.message
                  : "Failed to restore database.",
                500,
              ),
            );
          }
        })
        .catch((err: unknown) => {
          console.error("Failed to restore database:", err);
          finish(
            errorJson(
              "RESTORE_FAILED",
              err instanceof Error
                ? err.message
                : "Failed to restore database.",
              500,
            ),
          );
        });
    });

    busboy.on("error", (err: Error) => {
      console.error("Busboy error:", err);
      finish(errorJson("RESTORE_FAILED", err.message, 500));
    });

    busboy.on("finish", () => {
      if (!fileReceived) {
        finish(errorJson("BAD_REQUEST", "No file uploaded.", 400));
      }
    });

    const nodeStream = Readable.fromWeb(
      request.body as import("stream/web").ReadableStream,
    );
    nodeStream.pipe(busboy);
  });
}
