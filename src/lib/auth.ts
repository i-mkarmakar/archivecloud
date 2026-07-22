export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

export function clerkUserToAuthUser(user: {
  id: string;
  fullName?: string | null;
  firstName?: string | null;
  primaryEmailAddress?: { emailAddress: string } | null;
  emailAddresses?: Array<{ emailAddress: string }>;
}): AuthUser {
  const email =
    user.primaryEmailAddress?.emailAddress ??
    user.emailAddresses?.[0]?.emailAddress ??
    "";
  const name =
    user.fullName?.trim() ||
    user.firstName?.trim() ||
    email.split("@")[0] ||
    "User";
  return { id: user.id, name, email };
}
