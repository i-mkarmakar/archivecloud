"use client";

import { toast } from "@heroui/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { OtpInput } from "@/components/auth/otp-input";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { maskEmail } from "@/lib/mask-email";
import { cn } from "@/lib/utils";

export function VerifyEmailForm({ className }: { className?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [error, setError] = useState("");

  const callbackUrl = searchParams.get("callbackUrl");
  const redirectPath =
    callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//")
      ? callbackUrl
      : "/all-files";

  useEffect(() => {
    const emailParam = searchParams.get("email")?.trim();
    if (emailParam) setEmail(emailParam);
  }, [searchParams]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setTimeout(() => {
      setResendSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  async function resendCode() {
    if (!email.trim()) {
      toast.danger("Enter your email address.");
      return;
    }

    setError("");
    const { error: resendError } =
      await authClient.emailOtp.sendVerificationOtp({
        email: email.trim(),
        type: "email-verification",
      });

    if (resendError) {
      setError(resendError.message ?? "Failed to resend verification code.");
      toast.danger(
        resendError.message ?? "Failed to resend verification code.",
      );
      return;
    }

    setResendSeconds(60);
    toast.success("Verification code sent.");
  }

  async function verifyEmail(event: FormEvent) {
    event.preventDefault();
    if (otp.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }

    setLoading(true);
    setError("");

    const { error: verifyError } = await authClient.emailOtp.verifyEmail({
      email: email.trim(),
      otp,
    });

    setLoading(false);

    if (verifyError) {
      setError(verifyError.message ?? "Verification failed.");
      toast.danger(verifyError.message ?? "Verification failed.");
      return;
    }

    toast.success("Email verified. Sign in to continue.");
    router.push(
      `/signin?verified=1&email=${encodeURIComponent(email.trim())}&callbackUrl=${encodeURIComponent(redirectPath)}`,
    );
  }

  return (
    <form
      className={cn("flex w-full max-w-sm flex-col gap-6", className)}
      onSubmit={verifyEmail}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Verify your email</h1>
          <p className="text-sm text-balance text-muted-foreground">
            {email
              ? `We sent a 6-digit code to ${maskEmail(email)}`
              : "Enter the 6-digit code we sent to your email"}
          </p>
        </div>

        {!email ? (
          <Field>
            <FieldLabel htmlFor="verify-email">Email</FieldLabel>
            <Input
              id="verify-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="m@example.com"
              required
            />
          </Field>
        ) : null}

        <Field className="items-center">
          <FieldLabel className="w-full text-center">
            Verification code
          </FieldLabel>
          <OtpInput
            className="mx-auto w-fit"
            value={otp}
            onChange={(value) => {
              setOtp(value);
              setError("");
            }}
            isInvalid={Boolean(error)}
            isDisabled={loading}
            autoFocus
          />
          {error ? (
            <FieldDescription className="text-center text-destructive">
              {error}
            </FieldDescription>
          ) : null}
        </Field>

        <Field>
          <Button
            type="submit"
            disabled={loading || otp.length !== 6}
            size="lg"
            className="w-full"
          >
            {loading ? "Verifying..." : "Verify email"}
          </Button>
        </Field>

        <FieldDescription className="flex flex-wrap items-center justify-center gap-1 text-center">
          <span>Didn&apos;t receive a code?</span>
          <button
            type="button"
            className="font-medium text-foreground underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={loading || resendSeconds > 0 || !email.trim()}
            onClick={resendCode}
          >
            {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend"}
          </button>
        </FieldDescription>

        <FieldDescription className="text-center">
          <Link href="/signin" className="underline underline-offset-4">
            Back to sign in
          </Link>
        </FieldDescription>
      </FieldGroup>
    </form>
  );
}
