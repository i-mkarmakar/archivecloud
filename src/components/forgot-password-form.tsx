"use client";

import { Eye, EyeSlash } from "@gravity-ui/icons";
import {
  FieldError,
  Form,
  Input,
  Label,
  TextField,
  toast,
} from "@heroui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { OtpInput } from "@/components/auth/otp-input";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";
import { validateEmail } from "@/lib/validate-email";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validatePassword,
} from "@/lib/validate-password";
import { cn } from "@/lib/utils";

type ForgotPasswordStep = "email" | "reset";

type FieldErrors = Partial<
  Record<"email" | "otp" | "password" | "confirmPassword", string>
>;

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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [sendingCode, setSendingCode] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  function clearFieldError(key: keyof FieldErrors) {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

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
    if (sendingCode || resetting) return;

    const emailErr = validateEmail(email);
    if (emailErr) {
      setFieldErrors({ email: emailErr });
      return;
    }
    setFieldErrors({});

    setSendingCode(true);
    const { error } = await authClient.emailOtp.requestPasswordReset({
      email: email.trim(),
    });
    setSendingCode(false);

    if (error) {
      const message = error.message ?? "Failed to send reset code.";
      setFieldErrors({ email: message });
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
    if (sendingCode || resetting) return;

    const next: FieldErrors = {};
    if (otp.trim().length < 6) {
      next.otp = "Enter the 6-digit code from your email.";
    }
    const passwordErr = validatePassword(password);
    if (passwordErr) next.password = passwordErr;
    if (!confirmPassword) {
      next.confirmPassword = "Confirm your password.";
    } else if (password !== confirmPassword) {
      next.confirmPassword = "Passwords do not match.";
    }
    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;

    setResetting(true);
    const { error } = await authClient.emailOtp.resetPassword({
      email: email.trim(),
      otp: otp.trim(),
      password,
    });
    setResetting(false);

    if (error) {
      const message = error.message ?? "Failed to reset password.";
      const lower = message.toLowerCase();
      if (lower.includes("otp") || lower.includes("code")) {
        setFieldErrors({ otp: message });
        return;
      }
      if (lower.includes("password")) {
        setFieldErrors({ password: message });
        return;
      }
      toast.danger(message);
      return;
    }

    toast.success("Password updated. You can sign in now.");
    router.push("/auth/sign-in");
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
          <Form
            className="grid gap-4"
            validationBehavior="aria"
            onSubmit={sendResetCode}
          >
            <TextField
              name="email"
              fullWidth
              isRequired
              isInvalid={Boolean(fieldErrors.email)}
              value={email}
              onChange={(value) => {
                setEmail(value);
                clearFieldError("email");
              }}
            >
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="m@example.com"
                autoComplete="email"
              />
              <FieldError>{fieldErrors.email}</FieldError>
            </TextField>
            <Field>
              <Button
                type="submit"
                isPending={sendingCode}
                size="lg"
                className="w-full"
              >
                {sendingCode ? "Sending code..." : "Send reset code"}
              </Button>
            </Field>
          </Form>
        ) : (
          <Form
            className="grid gap-4"
            validationBehavior="aria"
            onSubmit={resetPassword}
          >
            <TextField name="email" fullWidth isReadOnly value={email}>
              <Label>Email</Label>
              <Input type="email" />
            </TextField>

            <div className="grid gap-1.5">
              <Label>Verification code</Label>
              <OtpInput
                value={otp}
                onChange={(value) => {
                  setOtp(value);
                  clearFieldError("otp");
                }}
                isInvalid={Boolean(fieldErrors.otp)}
                autoFocus
              />
              {fieldErrors.otp ? (
                <p className="text-sm text-danger" role="alert">
                  {fieldErrors.otp}
                </p>
              ) : (
                <FieldDescription className="flex items-center justify-between gap-3">
                  <span>Check your inbox for the 6-digit code.</span>
                  <button
                    type="button"
                    className="shrink-0 underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={sendingCode || resetting || resendSeconds > 0}
                    aria-busy={sendingCode}
                    onClick={() => sendResetCode()}
                  >
                    {sendingCode
                      ? "Sending..."
                      : resendSeconds > 0
                        ? `Resend in ${resendSeconds}s`
                        : "Resend code"}
                  </button>
                </FieldDescription>
              )}
            </div>

            <TextField
              name="password"
              fullWidth
              isRequired
              isInvalid={Boolean(fieldErrors.password)}
              value={password}
              onChange={(value) => {
                setPassword(value);
                clearFieldError("password");
              }}
            >
              <Label>New password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  className="pr-9"
                  minLength={PASSWORD_MIN_LENGTH}
                  maxLength={PASSWORD_MAX_LENGTH}
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
              <FieldError>{fieldErrors.password}</FieldError>
            </TextField>

            <TextField
              name="confirmPassword"
              fullWidth
              isRequired
              isInvalid={Boolean(fieldErrors.confirmPassword)}
              value={confirmPassword}
              onChange={(value) => {
                setConfirmPassword(value);
                clearFieldError("confirmPassword");
              }}
            >
              <Label>Confirm new password</Label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={PASSWORD_MIN_LENGTH}
                  maxLength={PASSWORD_MAX_LENGTH}
                  className="pr-9"
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
              <FieldError>{fieldErrors.confirmPassword}</FieldError>
            </TextField>

            <Field>
              <Button
                type="submit"
                disabled={sendingCode}
                isPending={resetting}
                size="lg"
                className="w-full"
              >
                {resetting ? "Updating password..." : "Update password"}
              </Button>
            </Field>
          </Form>
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
          <Link href="/auth/sign-up" className="underline underline-offset-4">
            Create account
          </Link>
        </FieldDescription>
      </FieldGroup>
    </div>
  );
}
