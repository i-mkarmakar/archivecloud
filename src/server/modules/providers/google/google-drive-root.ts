import "server-only";

import { google } from "googleapis";
import type { ConnectedAccount } from "@/generated/prisma/client";
import { prisma } from "@/server/config/prisma";
import { getAuthedGoogleClient } from "@/server/modules/providers/google/google.service";

/** Resolve My Drive root id via files.get(fileId=root). */
export async function fetchGoogleDriveRootId(
  account: ConnectedAccount,
): Promise<string> {
  const auth = await getAuthedGoogleClient(account);
  const drive = google.drive({ version: "v3", auth });
  const response = await drive.files.get({
    fileId: "root",
    fields: "id",
  });
  const id = response.data.id;
  if (!id) throw new Error("Google Drive root id missing.");
  return id;
}

export async function ensureGoogleDriveRootProviderId(
  accountId: string,
): Promise<string> {
  const account = await prisma.connectedAccount.findUniqueOrThrow({
    where: { id: accountId },
  });
  if (account.indexRootProviderId) return account.indexRootProviderId;
  const rootId = await fetchGoogleDriveRootId(account);
  await prisma.connectedAccount.update({
    where: { id: accountId },
    data: { indexRootProviderId: rootId },
  });
  return rootId;
}
