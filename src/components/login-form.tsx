"use client";

import { Eye, EyeSlash } from "@gravity-ui/icons";
import { toast } from "@heroui/react";
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
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { markAppBoot } from "@/lib/app-boot";
import { authClient } from "@/lib/auth-client";
import { safeCallbackUrl } from "@/lib/safe-callback-url";
import { cn } from "@/lib/utils";

type AuthMode = "signin" | "signup";

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
    setLoading(true);

    const fetchOptions = captchaFetchOptions(captchaToken);

    if (isSignIn) {
      const { data, error } = await authClient.signIn.email({
        email,
        password,
        fetchOptions,
      });
      setLoading(false);
      resetCaptcha();
      if (error) {
        if (error.code === "EMAIL_NOT_VERIFIED") {
          toast.danger("Verify your email before signing in.");
          router.push(
            `/verify-email?email=${encodeURIComponent(email)}&callbackUrl=${encodeURIComponent(redirectPath)}`,
          );
          return;
        }
        toast.danger(
          isCaptchaAuthError(error)
            ? CAPTCHA_ERROR_MESSAGE
            : (error.message ?? "Sign-in failed"),
        );
        return;
      }
      if (data) {
        onEnterApp(redirectPath);
      }
      return;
    }

    const verifyUrl = `/verify-email?email=${encodeURIComponent(email)}&callbackUrl=${encodeURIComponent(redirectPath)}`;
    const { error } = await authClient.signUp.email({
      email,
      password,
      name: `${firstName.trim()} ${lastName.trim()}`.trim(),
      callbackURL: verifyUrl,
      fetchOptions,
    });
    setLoading(false);
    resetCaptcha();
    if (error) {
      toast.danger(
        isCaptchaAuthError(error)
          ? CAPTCHA_ERROR_MESSAGE
          : (error.message ?? "Sign-up failed"),
      );
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
    <form className={cn("flex flex-col gap-4", className)} onSubmit={submit}>
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
            <Field className="gap-1.5">
              <FieldLabel htmlFor="firstName">First Name</FieldLabel>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                required
              />
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="lastName">Last Name</FieldLabel>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                required
              />
            </Field>
          </div>
        ) : null}

        <Field className="gap-1.5">
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="m@example.com"
            required
          />
        </Field>

        <Field className="gap-1.5">
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={isSignIn ? undefined : 8}
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
        </Field>

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
    </form>
  );
}
