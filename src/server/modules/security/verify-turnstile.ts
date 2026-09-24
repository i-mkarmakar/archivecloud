import "server-only";

import { env } from "@/server/config/env";

export async function verifyTurnstileToken(token: string | undefined | null) {
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    // Turnstile not configured — allow (matches client TURNSTILE_ENABLED).
    return { ok: true as const };
  }
  if (!token?.trim()) {
    return { ok: false as const, message: "Captcha verification is required." };
  }

  const body = new URLSearchParams({
    secret,
    response: token.trim(),
  });

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );

  const data = (await response.json()) as {
    success?: boolean;
    "error-codes"?: string[];
  };

  if (!data.success) {
    return {
      ok: false as const,
      message: "Captcha verification failed. Please try again.",
    };
  }

  return { ok: true as const };
}
