import "server-only";

import { Resend } from "resend";
import { env } from "@/server/config/env";

type OtpEmailType =
  | "sign-in"
  | "email-verification"
  | "forget-password"
  | "change-email";

function otpSubject(type: OtpEmailType) {
  switch (type) {
    case "forget-password":
      return "Reset your Archive Cloud password";
    case "sign-in":
      return "Your Archive Cloud sign-in code";
    case "email-verification":
      return "Verify your Archive Cloud email";
    case "change-email":
      return "Confirm your Archive Cloud email change";
    default:
      return "Your Archive Cloud verification code";
  }
}

function otpHeading(type: OtpEmailType) {
  switch (type) {
    case "forget-password":
      return "Password reset code";
    case "sign-in":
      return "Sign-in code";
    case "email-verification":
      return "Email verification code";
    case "change-email":
      return "Email change code";
    default:
      return "Verification code";
  }
}

function otpMessage(type: OtpEmailType) {
  switch (type) {
    case "forget-password":
      return "Use this code to reset your Archive Cloud password. It expires in 5 minutes.";
    case "sign-in":
      return "Use this code to sign in to Archive Cloud. It expires in 5 minutes.";
    case "email-verification":
      return "Use this code to verify your email address. It expires in 5 minutes.";
    case "change-email":
      return "Use this code to confirm your email change. It expires in 5 minutes.";
    default:
      return "Use this code to continue. It expires in 5 minutes.";
  }
}

function buildOtpEmailHtml(type: OtpEmailType, otp: string) {
  const heading = otpHeading(type);
  const message = otpMessage(type);

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827; max-width: 480px;">
      <h1 style="font-size: 20px; margin: 0 0 12px;">${heading}</h1>
      <p style="margin: 0 0 16px; color: #4b5563;">${message}</p>
      <p style="font-size: 32px; font-weight: 700; letter-spacing: 0.3em; margin: 0 0 16px;">${otp}</p>
      <p style="margin: 0; color: #6b7280; font-size: 14px;">
        If you did not request this email, you can ignore it.
      </p>
    </div>
  `.trim();
}

export async function sendVerificationOtpEmail({
  email,
  otp,
  type,
}: {
  email: string;
  otp: string;
  type: OtpEmailType;
}) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    throw new Error(
      "Email delivery is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL in .env.",
    );
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: email,
    subject: otpSubject(type),
    html: buildOtpEmailHtml(type, otp),
  });

  if (error) {
    throw new Error(error.message || "Failed to send verification email.");
  }
}
