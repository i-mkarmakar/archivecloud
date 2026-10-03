/**
 * Archive Cloud password policy — aligned with Better Auth defaults
 * (`emailAndPassword.minPasswordLength` / `maxPasswordLength`).
 *
 * Length-only: no complexity / character-class requirements.
 * Passwords are validated as entered (no trim).
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const PASSWORD_POLICY_MESSAGE = `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters.`;

/**
 * Returns a user-facing error message, or null if the password is valid.
 * Does not log or echo the password value.
 */
export function validatePassword(password: string): string | null {
  if (typeof password !== "string" || password.length === 0) {
    return "Password is required.";
  }
  if (
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH
  ) {
    return PASSWORD_POLICY_MESSAGE;
  }
  return null;
}
