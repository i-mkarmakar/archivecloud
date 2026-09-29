import "server-only";

import { Resend } from "resend";
import { env } from "@/server/config/env";

const WELCOME_TEMPLATE_ID = "welcome-email";

function firstName(name: string | null | undefined) {
  const trimmed = name?.trim();
  if (!trimmed) return undefined;
  return trimmed.split(/\s+/)[0];
}

export async function sendWelcomeEmail({
  email,
  name,
}: {
  email: string;
  name?: string | null;
}) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    return;
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: email,
    template: {
      id: WELCOME_TEMPLATE_ID,
      variables: {
        first_name: firstName(name) ?? "User",
      },
    },
  });

  if (error) {
    throw new Error(error.message || "Failed to send welcome email.");
  }
}
