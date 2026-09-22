"use client";

import { toast } from "@heroui/react";
import { Eye, EyeSlash } from "@gravity-ui/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { AppPreloader } from "@/components/AppPreloader";
import { GoogleLogo } from "@/components/auth/GoogleLogo";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { markAppBoot } from "@/lib/app-boot";
import { safeCallbackUrl } from "@/lib/safe-callback-url";
import { cn } from "@/lib/utils";

type AuthMode = "signin" | "signup";

export function LoginForm({
  mode,
  className,
}: {
  mode: AuthMode;
  className?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    data: session,
    isPending: sessionPending,
    isRefetching: sessionRefetching,
  } = authClient.useSession();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [enteringApp, setEnteringApp] = useState(false);

  const isSignIn = mode === "signin";
  const redirectPath = safeCallbackUrl(searchParams.get("callbackUrl"));

  function enterApp(path: string = redirectPath) {
    markAppBoot();
    setEnteringApp(true);
    router.replace(path);
    router.refresh();
  }

  useEffect(() => {
    // Wait out pending/refetch so a just-signed-out stale session does not
    // immediately bounce us into the app preloader → /home loop.
    if (sessionPending || sessionRefetching) return;
    if (!session) {
      if (enteringApp) setEnteringApp(false);
      return;
    }
    if (enteringApp) return;
    enterApp(redirectPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, sessionPending, sessionRefetching]);

  useEffect(() => {
    if (!isSignIn) return;
    if (searchParams.get("verified") !== "1") return;
    const verifiedEmail = searchParams.get("email")?.trim();
    if (verifiedEmail) setEmail(verifiedEmail);
    toast.success("Email verified. Sign in to continue.");
  }, [isSignIn, searchParams]);

  async function continueWithGoogle() {
    if (loading || googleLoading || enteringApp) return;
    setGoogleLoading(true);
    markAppBoot();
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: redirectPath,
      });
    } catch {
      setGoogleLoading(false);
      toast.danger("Google sign-in failed. Please try again.");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || googleLoading || enteringApp) return;
    setLoading(true);

    if (isSignIn) {
      const { data, error } = await authClient.signIn.email({
        email,
        password,
      });
      setLoading(false);
      if (error) {
        if (error.code === "EMAIL_NOT_VERIFIED") {
          toast.danger("Verify your email before signing in.");
          router.push(
            `/verify-email?email=${encodeURIComponent(email)}&callbackUrl=${encodeURIComponent(redirectPath)}`,
          );
          return;
        }
        toast.danger(error.message ?? "Sign-in failed");
        return;
      }
      if (data) {
        enterApp(redirectPath);
      }
      return;
    }

    const verifyUrl = `/verify-email?email=${encodeURIComponent(email)}&callbackUrl=${encodeURIComponent(redirectPath)}`;
    const { error } = await authClient.signUp.email({
      email,
      password,
      name: `${firstName.trim()} ${lastName.trim()}`.trim(),
      callbackURL: verifyUrl,
    });
    setLoading(false);
    if (error) {
      toast.danger(error.message ?? "Sign-up failed");
      return;
    }
    toast.success("Check your email for a 6-digit verification code.");
    router.push(verifyUrl);
  }

  if (enteringApp) {
    return <AppPreloader />;
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
              disabled={googleLoading}
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
