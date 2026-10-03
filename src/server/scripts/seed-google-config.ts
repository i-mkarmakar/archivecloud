import { prisma } from "../config/prisma";
import { googleDriveOAuthScopes } from "../modules/providers/scopes";
import { encryptText } from "../utils/crypto";

async function main() {
  // Seed runs via tsx outside Next — keep raw process.env (not env.ts).
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ??
    "http://localhost:9050/connected-accounts/google/callback";

  if (!clientId || !clientSecret)
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required.");

  await prisma.providerConfig.updateMany({
    where: { userId: null, provider: "google_drive", status: "active" },
    data: { status: "disabled" },
  });

  const config = await prisma.providerConfig.create({
    data: {
      userId: null,
      provider: "google_drive",
      clientIdEncrypted: encryptText(clientId),
      clientSecretEncrypted: encryptText(clientSecret),
      redirectUri,
      scopes: googleDriveOAuthScopes,
      status: "active",
    },
  });

  console.log(`Seeded global Google Drive config: ${config.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
