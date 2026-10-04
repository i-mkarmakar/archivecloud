import "server-only";

import {
  ICloudClient,
  type ICloudAccountInfo,
} from "@/server/modules/icloud/icloud-client";
import { randomToken } from "@/server/utils/crypto";

export type ICloudStoredSession = {
  appleId: string;
  password: string;
  trustToken?: string;
  sessionToken?: string;
  cookies: string[];
  accountInfo?: ICloudAccountInfo | null;
  accountCountry?: string;
};

type PendingAuth = {
  client: ICloudClient;
  userId: string;
  provider: "icloud_drive" | "icloud_photos";
  appleId: string;
  password: string;
  displayName: string;
  expiresAt: number;
};

/**
 * ponytail: pending MFA lives in memory (lost on restart). Redis/DB if multi-instance.
 */
const pending = new Map<string, PendingAuth>();
const PENDING_TTL_MS = 10 * 60 * 1000;

export function createICloudClient(appleId: string, password: string) {
  return new ICloudClient(appleId, password);
}

export function stashPendingICloudAuth(params: Omit<PendingAuth, "expiresAt">) {
  const challengeId = randomToken(24);
  pending.set(challengeId, {
    ...params,
    expiresAt: Date.now() + PENDING_TTL_MS,
  });
  return challengeId;
}

export function takePendingICloudAuth(challengeId: string): PendingAuth | null {
  const entry = pending.get(challengeId);
  if (!entry) return null;
  pending.delete(challengeId);
  if (entry.expiresAt < Date.now()) return null;
  return entry;
}

export function sessionFromClient(
  client: ICloudClient,
  appleId: string,
  password: string,
): ICloudStoredSession {
  const stored = client.toStored();
  return {
    appleId,
    password,
    trustToken: stored.trustToken,
    sessionToken: stored.sessionToken,
    cookies: stored.cookies,
    accountInfo: stored.accountInfo,
    accountCountry: stored.accountCountry,
  };
}

export async function getReadyICloudClient(
  session: ICloudStoredSession,
): Promise<{ client: ICloudClient; refreshed: ICloudStoredSession | null }> {
  const client = createICloudClient(session.appleId, session.password);
  client.restore({
    trustToken: session.trustToken,
    sessionToken: session.sessionToken,
    cookies: session.cookies,
    accountInfo: session.accountInfo,
    accountCountry: session.accountCountry,
  });

  if (client.status === "ready") {
    try {
      await client.getStorageUsage();
      return { client, refreshed: null };
    } catch {
      // cookies expired — fall through to password + trust re-auth
    }
  }

  await client.authenticate();
  if (client.status === "mfa_required") {
    throw new Error(
      "iCloud session expired. Disconnect and reconnect your Apple account.",
    );
  }
  return {
    client,
    refreshed: sessionFromClient(client, session.appleId, session.password),
  };
}
