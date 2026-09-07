export type AuthUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
};

export function sessionUserToAuthUser(user: {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image ?? null,
  };
}
