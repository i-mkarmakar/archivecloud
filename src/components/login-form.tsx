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
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { GoogleLogo } from "@/components/auth/GoogleLogo";
import {
  CAPTCHA_ERROR_MESSAGE,
  captchaFetchOptions,
  isCaptchaAuthError,
  TURNSTILE_ENABLED,
  TurnstileField,
  type TurnstileFieldHandle,
} from "@/components/auth/turnstile-field";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldSeparator } from "@/components/ui/field";
import { markAppBoot } from "@/lib/app-boot";
import { authClient } from "@/lib/auth-client";
import { safeCallbackUrl } from "@/lib/safe-callback-url";
import { validateEmail } from "@/lib/validate-email";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validatePassword,
} from "@/lib/validate-password";
import { cn } from "@/lib/utils";

type AuthMode = "signin" | "signup";

type FieldErrors = Partial<
  Record<"firstName" | "lastName" | "email" | "password", string>
>;

function mapAuthFieldError(
  code: string | undefined,
  message: string,
): FieldErrors | null {
  const normalized = `${code ?? ""} ${message}`.toLowerCase();
  if (
    normalized.includes("already") ||
    normalized.includes("exists") ||
    code === "USER_ALREADY_EXISTS"
  ) {
    return { email: message || "An account with this email already exists." };
  }
  if (
    normalized.includes("invalid email or password") ||
    normalized.includes("invalid credentials") ||
    code === "INVALID_EMAIL_OR_PASSWORD"
  ) {
    return { password: message || "Invalid email or password." };
  }
  if (normalized.includes("password") && !normalized.includes("email")) {
    return { password: message };
  }
  if (normalized.includes("email")) {
    return { email: message };
  }
  return null;
}

export function LoginForm({
  mode,
  className,
  onEnterApp,
  onShowOverlay,
}: {
  mode: AuthMode;
  className?: string;
  /** Parent shows full-page AppPreloader and navigates into the app. */
  onEnterApp: (path?: string) => void;
  /** Full-page AppPreloader without navigating (e.g. Google OAuth handoff). */
  onShowOverlay?: (show: boolean) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileFieldHandle>(null);

  const isSignIn = mode === "signin";
  const redirectPath = safeCallbackUrl(searchParams.get("callbackUrl"));
  const captchaReady = !TURNSTILE_ENABLED || Boolean(captchaToken);

  function resetCaptcha() {
    setCaptchaToken(null);
    turnstileRef.current?.reset();
  }

  function clearFieldError(key: keyof FieldErrors) {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function validateFields(): FieldErrors {
    const next: FieldErrors = {};
    if (!isSignIn) {
      if (!firstName.trim()) next.firstName = "First name is required.";
      if (!lastName.trim()) next.lastName = "Last name is required.";
    }
    const emailErr = validateEmail(email);
    if (emailErr) next.email = emailErr;
    if (!password) {
      next.password = "Password is required.";
    } else if (!isSignIn) {
      const passwordErr = validatePassword(password);
      if (passwordErr) next.password = passwordErr;
    }
    return next;
  }

  useEffect(() => {
    if (!isSignIn) return;
    if (searchParams.get("verified") !== "1") return;
    const verifiedEmail = searchParams.get("email")?.trim();
    if (verifiedEmail) setEmail(verifiedEmail);
    toast.success("Email verified. Sign in to continue.");
  }, [isSignIn, searchParams]);

  async function continueWithGoogle() {
    if (loading || googleLoading) return;
    setGoogleLoading(true);
    markAppBoot();
    onShowOverlay?.(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: redirectPath,
      });
    } catch {
      setGoogleLoading(false);
      onShowOverlay?.(false);
      toast.danger("Google sign-in failed. Please try again.");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || googleLoading || !captchaReady) return;

    const nextErrors = validateFields();
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    const fetchOptions = captchaFetchOptions(captchaToken);

    if (isSignIn) {
      const { data, error } = await authClient.signIn.email({
        email: email.trim(),
        password,
        fetchOptions,
      });
      setLoading(false);
      resetCaptcha();
      if (error) {
        if (error.code === "EMAIL_NOT_VERIFIED") {
          toast.danger("Verify your email before signing in.");
          router.push(
            `/verify-email?email=${encodeURIComponent(email.trim())}&callbackUrl=${encodeURIComponent(redirectPath)}`,
          );
          return;
        }
        if (isCaptchaAuthError(error)) {
          toast.danger(CAPTCHA_ERROR_MESSAGE);
          return;
        }
        const message = error.message ?? "Sign-in failed";
        const mapped = mapAuthFieldError(error.code, message);
        if (mapped) {
          setFieldErrors(mapped);
          return;
        }
        toast.danger(message);
        return;
      }
      if (data) {
        onEnterApp(redirectPath);
      }
      return;
    }

    const verifyUrl = `/verify-email?email=${encodeURIComponent(email.trim())}&callbackUrl=${encodeURIComponent(redirectPath)}`;
    const { error } = await authClient.signUp.email({
      email: email.trim(),
      password,
      name: `${firstName.trim()} ${lastName.trim()}`.trim(),
      callbackURL: verifyUrl,
      fetchOptions,
    });
    setLoading(false);
    resetCaptcha();
    if (error) {
      if (isCaptchaAuthError(error)) {
        toast.danger(CAPTCHA_ERROR_MESSAGE);
        return;
      }
      const message = error.message ?? "Sign-up failed";
      const mapped = mapAuthFieldError(error.code, message);
      if (mapped) {
        setFieldErrors(mapped);
        return;
      }
      toast.danger(message);
      return;
    }
    toast.success("Check your email for a 6-digit verification code.");
    onShowOverlay?.(true);
    router.push(verifyUrl);
  }

  if (isSignIn && showForgotPassword) {
    return (
      <ForgotPasswordForm
        className={className}
        initialEmail={email}
        onBack={() => setShowForgotPassword(false)}
      />
    );
  }

  return (
    <Form
      className={cn("flex flex-col gap-4", className)}
      validationBehavior="aria"
      onSubmit={submit}
    >
      <FieldGroup className="gap-3">
        <div className="mb-3 flex flex-col items-center gap-0.5 text-center">
          <h1 className="text-2xl font-bold">
            {isSignIn ? "Sign In" : "Create an Account"}
          </h1>
          <p className="text-sm font-semibold text-muted-foreground">
            {isSignIn ? (
              <>
                Don&apos;t have an account?{" "}
                <Link
                  href="/auth/sign-up"
                  className="font-semibold text-foreground underline underline-offset-4"
                >
                  Register
                </Link>
              </>
            ) : (
              <>
                Already a part?{" "}
                <Link
                  href="/auth/sign-in"
                  className="font-semibold text-foreground underline underline-offset-4"
                >
                  Sign In
                </Link>
              </>
            )}
          </p>
        </div>

        {!isSignIn ? (
          <div className="grid grid-cols-2 gap-2">
            <TextField
              name="firstName"
              fullWidth
              isRequired
              isInvalid={Boolean(fieldErrors.firstName)}
              value={firstName}
              onChange={(value) => {
                setFirstName(value);
                clearFieldError("firstName");
              }}
              className="gap-1.5"
            >
              <Label>First Name</Label>
              <Input placeholder="John" autoComplete="given-name" />
              <FieldError>{fieldErrors.firstName}</FieldError>
            </TextField>
            <TextField
              name="lastName"
              fullWidth
              isRequired
              isInvalid={Boolean(fieldErrors.lastName)}
              value={lastName}
              onChange={(value) => {
                setLastName(value);
                clearFieldError("lastName");
              }}
              className="gap-1.5"
            >
              <Label>Last Name</Label>
              <Input placeholder="Doe" autoComplete="family-name" />
              <FieldError>{fieldErrors.lastName}</FieldError>
            </TextField>
          </div>
        ) : null}

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
          className="gap-1.5"
        >
          <Label>Email</Label>
          <Input
            type="email"
            placeholder="m@example.com"
            autoComplete="email"
          />
          <FieldError>{fieldErrors.email}</FieldError>
        </TextField>

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
          className="gap-1.5"
        >
          <Label>Password</Label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              autoComplete={isSignIn ? "current-password" : "new-password"}
              className="pr-9"
              {...(isSignIn
                ? { maxLength: PASSWORD_MAX_LENGTH }
                : {
                    minLength: PASSWORD_MIN_LENGTH,
                    maxLength: PASSWORD_MAX_LENGTH,
                  })}
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
          {isSignIn ? (
            <div className="mt-0.5 flex justify-end">
              <button
                type="button"
                className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                onClick={() => setShowForgotPassword(true)}
              >
                Forgot password?
              </button>
            </div>
          ) : null}
        </TextField>

        <div className="flex flex-col gap-3">
          <Field>
            <Button
              type="submit"
              disabled={googleLoading || !captchaReady}
              isPending={loading}
              size="lg"
              className="w-full"
            >
              {loading
                ? isSignIn
                  ? "Signing in..."
                  : "Signing up..."
                : isSignIn
                  ? "Sign In"
                  : "Get Started"}
            </Button>
          </Field>

          <TurnstileField ref={turnstileRef} onTokenChange={setCaptchaToken} />

          <FieldSeparator className="my-0">or</FieldSeparator>

          <Field>
            <Button
              variant="outline"
              type="button"
              disabled={loading}
              isPending={googleLoading}
              size="lg"
              className="w-full"
              onClick={continueWithGoogle}
            >
              <GoogleLogo />
              {googleLoading ? "Redirecting..." : "Continue with Google"}
            </Button>
          </Field>

          <p className="text-center text-sm text-muted-foreground">
            By continuing, you agree to our
            <br />
            <Link
              href="/terms-of-service"
              className="underline underline-offset-4 hover:text-foreground"
            >
              Terms of Service
            </Link>{" "}
            &{" "}
            <Link
              href="/privacy-policy"
              className="underline underline-offset-4 hover:text-foreground"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </FieldGroup>
    </Form>
  );
}
