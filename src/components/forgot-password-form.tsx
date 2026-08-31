"use client";

import { toast } from "@heroui/react";
import { Eye, EyeSlash } from "@gravity-ui/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { cn } from "@/lib/utils";

type ForgotPasswordStep = "email" | "reset";

export function ForgotPasswordForm({
  initialEmail = "",
  className,
  onBack,
}: {
  initialEmail?: string;
  className?: string;
  onBack: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<ForgotPasswordStep>("email");
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    setEmail(initialEmail);
  }, [initialEmail]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setTimeout(() => {
      setResendSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  async function sendResetCode(event?: FormEvent) {
    event?.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.danger("Enter your email address.");
      return;
    }

    setSendingCode(true);
    const { error } = await authClient.emailOtp.requestPasswordReset({
      email: trimmedEmail,
    });
    setSendingCode(false);

    if (error) {
      toast.danger(error.message ?? "Failed to send reset code.");
      return;
    }

    setStep("reset");
    setOtp("");
    setResendSeconds(60);
    toast.success(
      "If an account exists for that email, a reset code was sent.",
    );
  }

  async function resetPassword(event: FormEvent) {
    event.preventDefault();
    const trimmedEmail = email.trim();

    if (otp.trim().length < 6) {
      toast.danger("Enter the 6-digit code from your email.");
      return;
    }
    if (password.length < 8) {
      toast.danger("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      toast.danger("Passwords do not match.");
      return;
    }

    setResetting(true);
    const { error } = await authClient.emailOtp.resetPassword({
      email: trimmedEmail,
      otp: otp.trim(),
      password,
    });
    setResetting(false);

    if (error) {
      toast.danger(error.message ?? "Failed to reset password.");
      return;
    }

    toast.success("Password updated. You can sign in now.");
    router.push("/signin");
    router.refresh();
  }

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Reset your password</h1>
          <p className="text-sm text-balance text-muted-foreground">
            {step === "email"
              ? "Enter your email and we will send a one-time code."
              : "Enter the code from your email and choose a new password."}
          </p>
        </div>

        {step === "email" ? (
          <form className="grid gap-4" onSubmit={sendResetCode}>
            <Field>
              <FieldLabel htmlFor="reset-email">Email</FieldLabel>
              <Input
                id="reset-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="m@example.com"
                required
              />
            </Field>
            <Field>
              <Button
                type="submit"
                disabled={sendingCode}
                size="lg"
                className="w-full"
              >
                {sendingCode ? "Sending code..." : "Send reset code"}
              </Button>
            </Field>
          </form>
        ) : (
          <form className="grid gap-4" onSubmit={resetPassword}>
            <Field>
              <FieldLabel htmlFor="reset-email-readonly">Email</FieldLabel>
              <Input
                id="reset-email-readonly"
                type="email"
                value={email}
                readOnly
              />
            </Field>

            <Field>
              <FieldLabel>Verification code</FieldLabel>
              <OtpInput
                value={otp}
                onChange={(value) => setOtp(value)}
                autoFocus
              />
              <FieldDescription className="flex items-center justify-between gap-3">
                <span>Check your inbox for the 6-digit code.</span>
                <button
                  type="button"
                  className="shrink-0 underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={sendingCode || resendSeconds > 0}
                  onClick={() => sendResetCode()}
                >
                  {resendSeconds > 0
                    ? `Resend in ${resendSeconds}s`
                    : "Resend code"}
                </button>
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="reset-password">New password</FieldLabel>
              <div className="relative">
                <Input
                  id="reset-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  className="pr-9"
                  required
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeSlash className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </Field>

            <Field>
              <FieldLabel htmlFor="reset-confirm-password">
                Confirm new password
              </FieldLabel>
              <div className="relative">
                <Input
                  id="reset-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  minLength={8}
                  className="pr-9"
                  required
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setShowConfirmPassword((visible) => !visible)}
                  aria-label={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                >
                  {showConfirmPassword ? (
                    <EyeSlash className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </Field>

            <Field>
              <Button
                type="submit"
                disabled={resetting}
                size="lg"
                className="w-full"
              >
                {resetting ? "Updating password..." : "Update password"}
              </Button>
            </Field>
          </form>
        )}

        <FieldDescription className="text-center">
          <button
            type="button"
            className="underline underline-offset-4"
            onClick={onBack}
          >
            Back to sign in
          </button>
          {" · "}
          <Link href="/signup" className="underline underline-offset-4">
            Create account
          </Link>
        </FieldDescription>
      </FieldGroup>
    </div>
  );
}
