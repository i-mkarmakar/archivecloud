export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

export function sessionUserToAuthUser(user: {
  id: string;
  name: string;
  email: string;
}): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}
