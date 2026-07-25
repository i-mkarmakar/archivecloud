import { z } from "zod";
import { prisma } from "@/server/config/prisma";
import { requireAuthUser } from "@/server/http/auth";
import { json } from "@/server/http/responses";
import { encryptText } from "@/server/utils/crypto";

const schema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUri: z.string().url(),
  scopes: z.array(z.string()).min(1),
});

export async function createGoogleProviderConfigHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const body = schema.parse(await request.json());
  const config = await prisma.providerConfig.create({
    data: {
      userId: user.id,
      provider: "google_drive",
      clientIdEncrypted: encryptText(body.clientId),
      clientSecretEncrypted: encryptText(body.clientSecret),
      redirectUri: body.redirectUri,
      scopes: body.scopes,
    },
  });
  return json(
    {
      id: config.id,
      provider: config.provider,
      redirectUri: config.redirectUri,
      scopes: config.scopes,
      status: config.status,
    },
    201,
  );
}

export async function listProviderConfigsHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const configs = await prisma.providerConfig.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      provider: true,
      redirectUri: true,
      scopes: true,
      status: true,
      createdAt: true,
    },
  });
  return json({ configs });
}

export async function deleteProviderConfigHandler(
  request: Request,
  _user?: unknown,
  params?: Record<string, string>,
) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;
  const id = params?.id;
  if (!id) return json({ status: "ok" });
  await prisma.providerConfig.deleteMany({ where: { id, userId: user.id } });
  return json({ status: "ok" });
}
