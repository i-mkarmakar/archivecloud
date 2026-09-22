import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { upgradeProfileImageUrl } from "@/lib/gravatar";
import { validatePassword } from "@/lib/validate-password";
import { prisma } from "@/server/config/prisma";
import { requireAuthUser } from "@/server/http/auth";
import { errorJson, json } from "@/server/http/responses";
import {
  ensureNewsletterPreference,
  setNewsletterPreference,
} from "@/server/modules/newsletter/subscribe";
import { stopGoogleDriveWatches } from "@/server/modules/webhooks/google-drive-watch";
import { createAuditLog } from "@/server/utils/audit";

const setPasswordBodySchema = z.object({
  newPassword: z.string().min(1),
});

export async function getAccountHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  const row = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
    },
  });

  return json({
    account: {
      id: row.id,
      name: row.name,
      email: row.email,
      image: row.image,
    },
  });
}

export async function syncGoogleAvatarHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  const row = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { id: true, image: true },
  });

  const existing = row.image?.trim() ?? "";
  if (existing) {
    const upgraded = upgradeProfileImageUrl(existing, 512);
    if (upgraded !== existing) {
      await auth.api.updateUser({
        headers: await headers(),
        body: { image: upgraded },
      });
      return json({ image: upgraded, synced: true });
    }
    return json({ image: existing, synced: false });
  }

  const googleAccount = await prisma.account.findFirst({
    where: { userId: user.id, providerId: "google" },
    select: { id: true },
  });

  if (!googleAccount) {
    return json({ image: null, synced: false });
  }

  try {
    const info = await auth.api.accountInfo({
      headers: await headers(),
      query: { accountId: googleAccount.id },
    });

    const picture =
      typeof info?.user?.image === "string" ? info.user.image.trim() : "";

    if (!picture) {
      return json({ image: null, synced: false });
    }

    const highRes = upgradeProfileImageUrl(picture, 512);

    await auth.api.updateUser({
      headers: await headers(),
      body: { image: highRes },
    });

    return json({ image: highRes, synced: true });
  } catch (error) {
    console.error("Failed to sync Google profile photo:", error);
    return errorJson(
      "GOOGLE_AVATAR_SYNC_FAILED",
      "Could not load Google profile photo.",
      400,
    );
  }
}

export async function setPasswordHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  let body: z.infer<typeof setPasswordBodySchema>;
  try {
    body = setPasswordBodySchema.parse(await request.json());
  } catch {
    return errorJson("VALIDATION_ERROR", "New password is required.", 400);
  }

  const passwordError = validatePassword(body.newPassword);
  if (passwordError) {
    return errorJson("VALIDATION_ERROR", passwordError, 400);
  }

  const accounts = await prisma.account.findMany({
    where: { userId: user.id },
    select: { providerId: true },
  });

  if (accounts.some((account) => account.providerId === "credential")) {
    return errorJson(
      "PASSWORD_ALREADY_SET",
      "A password is already set. Use password change or email reset instead.",
      400,
    );
  }

  try {
    await auth.api.setPassword({
      body: { newPassword: body.newPassword },
      headers: await headers(),
    });
  } catch (error) {
    return errorJson(
      "SET_PASSWORD_FAILED",
      error instanceof Error ? error.message : "Failed to set password.",
      400,
    );
  }

  return json({ success: true });
}

const deleteAccountBodySchema = z.object({
  reason: z.string().trim().min(1, "Reason is required").max(2000),
  confirmation: z.literal("DELETE"),
});

export async function getNewsletterHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  const account = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { email: true },
  });
  const row = await ensureNewsletterPreference({
    userId: user.id,
    email: account.email,
  });

  return json({
    subscribed: row?.subscribed ?? true,
    email: row?.email ?? account.email,
  });
}

const newsletterBodySchema = z.object({
  subscribed: z.boolean(),
});

export async function patchNewsletterHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  const body = newsletterBodySchema.parse(await request.json());
  const account = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { email: true },
  });
  const row = await setNewsletterPreference({
    userId: user.id,
    email: account.email,
    subscribed: body.subscribed,
  });

  return json({
    subscribed: row.subscribed,
    email: row.email,
  });
}

export async function deleteAccountHandler(request: Request) {
  const user = await requireAuthUser(request);
  if (user instanceof Response) return user;

  let body: z.infer<typeof deleteAccountBodySchema>;
  try {
    body = deleteAccountBodySchema.parse(await request.json());
  } catch {
    return errorJson(
      "VALIDATION_ERROR",
      "Provide a reason and type DELETE to confirm.",
      400,
    );
  }

  const connectedAccounts = await prisma.connectedAccount.findMany({
    where: { userId: user.id },
    select: { id: true },
  });

  for (const account of connectedAccounts) {
    try {
      await stopGoogleDriveWatches(account.id);
    } catch (error) {
      console.error("Failed to stop Google Drive watches:", error);
    }
    try {
      const { stopOneDriveSubscriptions } = await import(
        "@/server/modules/webhooks/onedrive-subscription"
      );
      await stopOneDriveSubscriptions(account.id);
    } catch (error) {
      console.error("Failed to stop OneDrive subscriptions:", error);
    }
  }

  try {
    await createAuditLog(user.id, "account.delete", "user", user.id, {
      reason: body.reason,
    });
    await prisma.user.delete({ where: { id: user.id } });
  } catch (error) {
    console.error("Failed to delete account:", error);
    return errorJson(
      "DELETE_ACCOUNT_FAILED",
      "Could not delete your account. Please try again.",
      500,
    );
  }

  return json({ success: true });
}
