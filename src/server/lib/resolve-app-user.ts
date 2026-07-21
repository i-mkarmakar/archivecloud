import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/server/config/prisma";

export async function resolveAppUser(clerkUserId: string) {
  const existing = await prisma.user.findUnique({ where: { clerkUserId } });
  if (existing) return existing;

  const client = await clerkClient();
  const clerkUser = await client.users.getUser(clerkUserId);
  const email =
    clerkUser.emailAddresses.find(
      (entry) => entry.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;

  if (!email) throw new Error("Clerk user has no email address.");

  const name =
    clerkUser.fullName?.trim() ||
    [clerkUser.firstName, clerkUser.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    email.split("@")[0] ||
    "User";

  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail) {
    return prisma.user.update({
      where: { id: byEmail.id },
      data: { clerkUserId, name },
    });
  }

  return prisma.user.create({
    data: {
      clerkUserId,
      email,
      name,
      passwordHash: null,
    },
  });
}
