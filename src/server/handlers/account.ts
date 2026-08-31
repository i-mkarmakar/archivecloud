import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { validatePassword } from "@/lib/validate-password";
import { prisma } from "@/server/config/prisma";
import { requireAuthUser } from "@/server/http/auth";
import { errorJson, json } from "@/server/http/responses";

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
    },
  });

  return json({
    account: {
      id: row.id,
      name: row.name,
      email: row.email,
    },
  });
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
