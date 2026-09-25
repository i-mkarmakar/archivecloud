import "server-only";

import { prisma } from "@/server/config/prisma";
import { runFolderSync } from "@/server/modules/sync/run-folder-sync";
import { createAuditLog } from "@/server/utils/audit";

const pendingByAccount = new Map<string, NodeJS.Timeout>();
const DEBOUNCE_MS = 3_000;

export function scheduleFolderSyncsForAccount(
  accountId: string,
  reason: string,
): void {
  const existing = pendingByAccount.get(accountId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    pendingByAccount.delete(accountId);
    void triggerFolderSyncsForAccount(accountId, reason).catch((error) => {
      console.error("Webhook folder sync trigger failed:", error);
    });
  }, DEBOUNCE_MS);

  pendingByAccount.set(accountId, timer);
}

export async function triggerFolderSyncsForAccount(
  accountId: string,
  reason: string,
): Promise<{ syncCount: number; queuedJobs: number }> {
  const syncs = await prisma.folderSync.findMany({
    where: {
      status: "active",
      OR: [{ sourceAccountId: accountId }, { destAccountId: accountId }],
    },
    orderBy: { updatedAt: "asc" },
    take: 15,
  });

  let queuedJobs = 0;

  for (const sync of syncs) {
    await prisma.folderSync.update({
      where: { id: sync.id },
      data: {
        lastContentHash: null,
        lastPolledAt: null,
      },
    });

    try {
      const result = await runFolderSync(sync.id, { manual: true });
      queuedJobs += result.queuedJobs;
      await createAuditLog(
        sync.userId,
        "FOLDER_SYNC_WEBHOOK",
        "folder_sync",
        sync.id,
        { reason, accountId, queuedJobs: result.queuedJobs },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Webhook sync failed.";
      console.error(`Folder sync ${sync.id} after webhook failed:`, message);
    }
  }

  return { syncCount: syncs.length, queuedJobs };
}
