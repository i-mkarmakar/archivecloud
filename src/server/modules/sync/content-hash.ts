import { createHash } from "node:crypto";
import type { ConnectedAccount } from "@/generated/prisma/client";
import { browseProviderFolder } from "@/server/modules/providers/operations";

export const MAX_SYNC_FOLDERS = 200;

export async function computeFolderTreeHash(
  account: ConnectedAccount,
  userId: string,
  rootParentId: string,
): Promise<string> {
  const entries: string[] = [];
  let foldersVisited = 0;

  type QueueItem = { parentId: string; path: string };
  const queue: QueueItem[] = [
    { parentId: rootParentId.trim() || "root", path: "" },
  ];

  while (queue.length > 0) {
    if (foldersVisited >= MAX_SYNC_FOLDERS) break;

    const current = queue.shift()!;
    foldersVisited += 1;

    const browse = await browseProviderFolder(
      account,
      userId,
      current.parentId,
    );

    for (const folder of browse.folders) {
      const folderPath = current.path
        ? `${current.path}/${folder.name}`
        : folder.name;
      entries.push(`d:${folderPath}`);
      if (foldersVisited + queue.length < MAX_SYNC_FOLDERS) {
        queue.push({ parentId: folder.id, path: folderPath });
      }
    }

    for (const file of browse.files) {
      const filePath = current.path
        ? `${current.path}/${file.name}`
        : file.name;
      entries.push(`f:${filePath}:${file.sizeBytes}:${file.id}`);
    }
  }

  entries.sort();
  return createHash("sha256").update(entries.join("\n")).digest("hex");
}

export async function computeFolderSyncContentHash(sync: {
  direction: string;
  sourceAccount: ConnectedAccount;
  destAccount: ConnectedAccount;
  userId: string;
  sourceParentId: string;
  destParentId: string;
}): Promise<string> {
  const sourceHash = await computeFolderTreeHash(
    sync.sourceAccount,
    sync.userId,
    sync.sourceParentId,
  );

  if (sync.direction !== "two_way") {
    return sourceHash;
  }

  const destHash = await computeFolderTreeHash(
    sync.destAccount,
    sync.userId,
    sync.destParentId,
  );

  return createHash("sha256")
    .update(`${sourceHash}\n${destHash}`)
    .digest("hex");
}
