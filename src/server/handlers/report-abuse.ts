import { z } from "zod";
import { Resend } from "resend";
import { ABUSE_CATEGORIES } from "@/lib/abuse-categories";
import { env } from "@/server/config/env";
import { errorJson, json } from "@/server/http/responses";
import { verifyTurnstileToken } from "@/server/modules/security/verify-turnstile";

const reportAbuseSchema = z.object({
  category: z.enum(ABUSE_CATEGORIES),
  comments: z.string().trim().max(2000).optional().default(""),
  email: z.string().trim().email().max(191),
  shareUrl: z.string().trim().min(1).max(2048),
  fileName: z.string().trim().max(255).optional(),
  captchaToken: z.string().trim().optional(),
});

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function reportAbuseHandler(request: Request) {
  const body = reportAbuseSchema.parse(await request.json());

  let shareUrl = body.shareUrl;
  try {
    const parsed = new URL(shareUrl, env.APP_URL);
    shareUrl = parsed.toString();
  } catch {
    return errorJson("VALIDATION_ERROR", "Invalid share URL.", 400);
  }

  const captcha = await verifyTurnstileToken(body.captchaToken);
  if (!captcha.ok) {
    return errorJson("CAPTCHA_FAILED", captcha.message, 400);
  }

  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    return errorJson(
      "EMAIL_NOT_CONFIGURED",
      "Abuse reporting is temporarily unavailable.",
      503,
    );
  }

  const to =
    env.ADMIN_EMAIL?.split(",")
      .map((value) => value.trim())
      .filter(Boolean)[0] || "contact@archivecloud.com";

  const comments = body.comments?.trim() || "(none)";
  const fileName = body.fileName?.trim() || "Unknown file";

  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to,
    replyTo: body.email,
    subject: `[Abuse Report] ${body.category} — ${fileName}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827; max-width: 560px;">
        <h1 style="font-size: 18px; margin: 0 0 12px;">New abuse report</h1>
        <p style="margin: 0 0 8px;"><strong>Category:</strong> ${escapeHtml(body.category)}</p>
        <p style="margin: 0 0 8px;"><strong>Reporter:</strong> ${escapeHtml(body.email)}</p>
        <p style="margin: 0 0 8px;"><strong>File:</strong> ${escapeHtml(fileName)}</p>
        <p style="margin: 0 0 8px;"><strong>Share URL:</strong> <a href="${escapeHtml(shareUrl)}">${escapeHtml(shareUrl)}</a></p>
        <p style="margin: 16px 0 4px;"><strong>Comments:</strong></p>
        <p style="margin: 0; white-space: pre-wrap; color: #374151;">${escapeHtml(comments)}</p>
      </div>
    `.trim(),
  });

  if (error) {
    return errorJson(
      "EMAIL_SEND_FAILED",
      error.message || "Failed to send abuse report.",
      500,
    );
  }

  return json({ status: "ok" }, 201);
}
