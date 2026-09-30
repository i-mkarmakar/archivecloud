import { prisma } from "@/server/config/prisma";
import { requireAuthUser } from "@/server/http/auth";
import { json } from "@/server/http/responses";
import { listGoogleSharedWithMe } from "@/server/modules/providers/google/google.service";

export async function listCloudSharedFoldersHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  const accounts = await prisma.connectedAccount.findMany({
    where: {
      userId: user.id,
      provider: "google_drive",
      status: "connected",
    },
    orderBy: { createdAt: "asc" },
  });

  const folders: Array<{
    id: string;
    name: string;
    accountId: string;
    accountEmail: string;
    sharedBy: string | null;
    updatedAt: string | null;
    openUrl: string;
  }> = [];
  const files: Array<{
    id: string;
    name: string;
    mimeType: string;
    sizeBytes: string;
    accountId: string;
    accountEmail: string;
    sharedBy: string | null;
    updatedAt: string | null;
    openUrl: string;
  }> = [];

  await Promise.all(
    accounts.map(async (account) => {
      try {
        const shared = await listGoogleSharedWithMe(account);
        for (const folder of shared.folders) {
          folders.push({
            ...folder,
            accountId: account.id,
            accountEmail: account.email,
          });
        }
        for (const file of shared.files) {
          files.push({
            ...file,
            accountId: account.id,
            accountEmail: account.email,
          });
        }
      } catch {
        // Skip accounts that fail (revoked token, API error).
      }
    }),
  );

  return json({ folders, files });
}
