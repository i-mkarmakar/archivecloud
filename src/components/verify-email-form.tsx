"use client";

import {
  FieldError,
  Form,
  Input,
  Label,
  TextField,
  toast,
} from "@heroui/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { OtpInput } from "@/components/auth/otp-input";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";
import { maskEmail } from "@/lib/mask-email";
import { safeCallbackUrl } from "@/lib/safe-callback-url";
import { validateEmail } from "@/lib/validate-email";
import { cn } from "@/lib/utils";

export function VerifyEmailForm({
  className,
  onShowOverlay,
}: {
  className?: string;
  /** Full-page AppPreloader while navigating away from AuthShell. */
  onShowOverlay?: (show: boolean) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [emailError, setEmailError] = useState("");
  const [otpError, setOtpError] = useState("");

  const redirectPath = safeCallbackUrl(searchParams.get("callbackUrl"));
  const busy = verifying || resending;
  const emailFromQuery = Boolean(searchParams.get("email")?.trim());

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
    if (busy) return;
    const emailErr = validateEmail(email);
    if (emailErr) {
      setEmailError(emailErr);
      return;
    }

    setEmailError("");
    setOtpError("");
    setResending(true);
    const { error: resendError } =
      await authClient.emailOtp.sendVerificationOtp({
        email: email.trim(),
        type: "email-verification",
      });
    setResending(false);

    if (resendError) {
      const message =
        resendError.message ?? "Failed to resend verification code.";
      setOtpError(message);
      toast.danger(message);
      return;
    }

    setResendSeconds(60);
    toast.success("Verification code sent.");
  }

  async function verifyEmail(event: FormEvent) {
    event.preventDefault();
    if (busy) return;

    const emailErr = validateEmail(email);
    if (emailErr) {
      setEmailError(emailErr);
      return;
    }
    if (otp.length !== 6) {
      setOtpError("Enter the 6-digit code from your email.");
      return;
    }

    setVerifying(true);
    setEmailError("");
    setOtpError("");

    const { error: verifyError } = await authClient.emailOtp.verifyEmail({
      email: email.trim(),
      otp,
    });

    setVerifying(false);

    if (verifyError) {
      const message = verifyError.message ?? "Verification failed.";
      setOtpError(message);
      toast.danger(message);
      return;
    }

    toast.success("Email verified. Sign in to continue.");
    onShowOverlay?.(true);
    router.push(
      `/auth/sign-in?verified=1&email=${encodeURIComponent(email.trim())}&callbackUrl=${encodeURIComponent(redirectPath)}`,
    );
  }

  return (
    <Form
      className={cn("flex w-full max-w-sm flex-col gap-6", className)}
      validationBehavior="aria"
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

        {!emailFromQuery ? (
          <TextField
            name="email"
            fullWidth
            isRequired
            isInvalid={Boolean(emailError)}
            value={email}
            onChange={(value) => {
              setEmail(value);
              setEmailError("");
            }}
          >
            <Label>Email</Label>
            <Input
              type="email"
              placeholder="m@example.com"
              autoComplete="email"
            />
            <FieldError>{emailError}</FieldError>
          </TextField>
        ) : null}

        <Field className="items-center">
          <Label className="w-full text-center">Verification code</Label>
          <OtpInput
            className="mx-auto w-fit"
            value={otp}
            onChange={(value) => {
              setOtp(value);
              setOtpError("");
            }}
            isInvalid={Boolean(otpError)}
            isDisabled={busy}
            autoFocus
          />
          {otpError ? (
            <p className="text-center text-sm text-danger" role="alert">
              {otpError}
            </p>
          ) : null}
        </Field>

        <Field>
          <Button
            type="submit"
            disabled={resending || otp.length !== 6}
            isPending={verifying}
            size="lg"
            className="w-full"
          >
            {verifying ? "Verifying..." : "Verify email"}
          </Button>
        </Field>

        <FieldDescription className="flex flex-wrap items-center justify-center gap-1 text-center">
          <span>Didn&apos;t receive a code?</span>
          <button
            type="button"
            className="font-medium text-foreground underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy || resendSeconds > 0 || !email.trim()}
            aria-busy={resending}
            onClick={resendCode}
          >
            {resending
              ? "Sending..."
              : resendSeconds > 0
                ? `Resend in ${resendSeconds}s`
                : "Resend"}
          </button>
        </FieldDescription>

        <FieldDescription className="text-center">
          <Link href="/auth/sign-in" className="underline underline-offset-4">
            Back to sign in
          </Link>
        </FieldDescription>
      </FieldGroup>
    </Form>
  );
}
