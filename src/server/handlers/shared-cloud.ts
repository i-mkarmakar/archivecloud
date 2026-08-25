import { requireAuthUser } from "@/server/http/auth";
import { json } from "@/server/http/responses";

export async function listCloudSharedFoldersHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  void user;
  return json({ folders: [], files: [] });
}