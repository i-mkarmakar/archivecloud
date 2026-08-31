export function maskEmail(email: string) {
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf("@");
  if (atIndex <= 0) return trimmed;

  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  if (!domain) return trimmed;

  const maskedLocal =
    local.length <= 1 ? `${local}****` : `${local.charAt(0)}****`;

  return `${maskedLocal}@${domain}`;
}
