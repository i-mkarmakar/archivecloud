import { prisma } from "../config/prisma";
import { encryptText } from "../utils/crypto";

const scopes = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

function isConfigured(value: string | undefined, placeholders: string[]) {
  if (!value?.trim()) return false;
  return !placeholders.includes(value.trim());
}

async function main() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI?.trim() ||
    "http://localhost:3000/connected-accounts/google/callback";

  const hasClientId = isConfigured(clientId, [
    "your-google-client-id",
    "your-client-id",
  ]);
  const hasClientSecret = isConfigured(clientSecret, [
    "your-google-client-secret",
    "your-client-secret",
  ]);

  if (!hasClientId || !hasClientSecret) {
    console.warn(
      "Skipping Google Drive config seed: GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET not configured. Set them in .env and run pnpm seed:google-config.",
    );
    return;
  }

  await prisma.providerConfig.updateMany({
    where: { userId: null, provider: "google_drive", status: "active" },
    data: { status: "disabled" },
  });

  const config = await prisma.providerConfig.create({
    data: {
      userId: null,
      provider: "google_drive",
      clientIdEncrypted: encryptText(clientId!),
      clientSecretEncrypted: encryptText(clientSecret!),
      redirectUri,
      scopes,
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
