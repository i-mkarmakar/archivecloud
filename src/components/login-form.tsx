"use client";

import { useAuth, useClerk, useSignIn, useSignUp } from "@clerk/nextjs";
import { Eye, EyeSlash } from "@gravity-ui/icons";
import { toast } from "@heroui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { FacebookLogo } from "@/components/auth/FacebookLogo";
import { GoogleLogo } from "@/components/auth/GoogleLogo";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type AuthMode = "signin" | "signup";
type OAuthProvider = "google" | "facebook";

const HOME_PATH = "/all-files";

const oauthStrategy: Record<OAuthProvider, "oauth_google" | "oauth_facebook"> =
  {
    google: "oauth_google",
    facebook: "oauth_facebook",
  };

function navigateAfterAuth(
  decorateUrl: (url: string) => string,
  router: ReturnType<typeof useRouter>,
) {
  const url = decorateUrl(HOME_PATH);
  // Absolute URLs are Clerk handshake redirects that sync the session cookie
  // for middleware — client router.push alone leaves you stuck on /signin.
  if (url.startsWith("http")) {
    window.location.href = url;
    return;
  }
  router.push(url);
}

export function LoginForm({
  mode,
  className,
}: {
  mode: AuthMode;
  className?: string;
}) {
  const router = useRouter();
  const clerk = useClerk();
  const { isLoaded, isSignedIn } = useAuth();
  const { signIn, fetchStatus: signInFetchStatus } = useSignIn();
  const { signUp, fetchStatus: signUpFetchStatus } = useSignUp();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [ssoLoading, setSsoLoading] = useState<OAuthProvider | null>(null);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      // Full navigation so middleware picks up the session cookie.
      window.location.replace(HOME_PATH);
    }
  }, [isLoaded, isSignedIn]);

  const loading =
    mode === "signin"
      ? signInFetchStatus === "fetching"
      : signUpFetchStatus === "fetching";
  const isSignIn = mode === "signin";

  async function continueWithOAuth(provider: OAuthProvider) {
    setSsoLoading(provider);

    const strategy = oauthStrategy[provider];
    const providerLabel = provider === "google" ? "Google" : "Facebook";

    if (isSignIn) {
      if (!signIn) return;
      const { error: ssoError } = await signIn.sso({
        strategy,
        redirectCallbackUrl: "/signin/sso-callback",
        redirectUrl: HOME_PATH,
      });
      if (ssoError) {
        toast.danger(ssoError.message ?? `${providerLabel} sign-in failed`);
        setSsoLoading(null);
      }
      return;
    }

    if (!signUp) return;
    const { error: ssoError } = await signUp.sso({
      strategy,
      redirectCallbackUrl: "/signup/sso-callback",
      redirectUrl: HOME_PATH,
      firstName: name.trim() || undefined,
    });
    if (ssoError) {
      toast.danger(ssoError.message ?? `${providerLabel} sign-up failed`);
      setSsoLoading(null);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSignIn) {
      if (!signIn) return;
      const { error: passwordError } = await signIn.password({
        emailAddress: email,
        password,
      });
      if (passwordError) {
        // Session already exists — activate it instead of showing a dead-end error.
        const existingSessionId = signIn.existingSession?.sessionId;
        if (existingSessionId) {
          await clerk.setActive({
            session: existingSessionId,
            navigate: ({ session, decorateUrl }) => {
              if (session?.currentTask) return;
              navigateAfterAuth(decorateUrl, router);
            },
          });
          return;
        }
        toast.danger(passwordError.message ?? "Sign-in failed");
        return;
      }
      if (signIn.status === "complete") {
        await signIn.finalize({
          navigate: ({ session, decorateUrl }) => {
            if (session?.currentTask) return;
            navigateAfterAuth(decorateUrl, router);
          },
        });
        return;
      }
      toast.info(
        "Additional verification is required. Try social sign-in or check your email.",
      );
      return;
    }

    if (!signUp) return;
    const { error: passwordError } = await signUp.password({
      emailAddress: email,
      password,
      firstName: name.trim(),
    });
    if (passwordError) {
      toast.danger(passwordError.message ?? "Sign-up failed");
      return;
    }
    if (signUp.status === "complete") {
      await signUp.finalize({
        navigate: ({ session, decorateUrl }) => {
          if (session?.currentTask) return;
          navigateAfterAuth(decorateUrl, router);
        },
      });
      return;
    }
    if (signUp.status === "missing_requirements") {
      await signUp.verifications.sendEmailCode();
      toast.info("Check your email for a verification code, then sign in.");
      return;
    }
    toast.danger(
      "Could not complete sign-up. Try Google or Facebook sign-up instead.",
    );
  }

  const authReady = isSignIn ? Boolean(signIn) : Boolean(signUp);
  const ssoBusy = ssoLoading !== null;

  if (!isLoaded || isSignedIn) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Redirecting...
      </p>
    );
  }

  return (
    <form className={cn("flex flex-col gap-6", className)} onSubmit={submit}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">
            {isSignIn ? "Login to your account" : "Create your account"}
          </h1>
          <p className="text-sm text-balance text-muted-foreground">
            {isSignIn
              ? "Enter your email below to login to your account"
              : "Enter your details below to create your ArchiveCloud account"}
          </p>
        </div>

        {!isSignIn ? (
          <Field>
            <FieldLabel htmlFor="name">Name</FieldLabel>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
            />
          </Field>
        ) : null}

        <Field>
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

        <Field>
          <div className="flex items-center">
            <FieldLabel htmlFor="password">Password</FieldLabel>
          </div>
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
        </Field>

        <Field>
          <Button
            type="submit"
            disabled={loading || !authReady}
            className="w-full"
          >
            {loading
              ? isSignIn
                ? "Signing in..."
                : "Signing up..."
              : isSignIn
                ? "Login"
                : "Sign up"}
          </Button>
        </Field>

        <FieldSeparator>Or continue with</FieldSeparator>

        <Field>
          <div className="grid gap-2">
            <Button
              variant="outline"
              type="button"
              disabled={ssoBusy || !authReady}
              className="w-full"
              onClick={() => continueWithOAuth("google")}
            >
              <GoogleLogo />
              {ssoLoading === "google"
                ? "Redirecting..."
                : "Continue with Google"}
            </Button>
            <Button
              variant="outline"
              type="button"
              disabled={ssoBusy || !authReady}
              className="w-full"
              onClick={() => continueWithOAuth("facebook")}
            >
              <FacebookLogo className="h-4 w-4 text-[#1877F2]" />
              {ssoLoading === "facebook"
                ? "Redirecting..."
                : "Continue with Facebook"}
            </Button>
          </div>
          {!isSignIn ? <div id="clerk-captcha" /> : null}
          <FieldDescription className="text-center">
            {isSignIn ? (
              <>
                Don&apos;t have an account?{" "}
                <Link href="/signup" className="underline underline-offset-4">
                  Sign up
                </Link>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <Link href="/signin" className="underline underline-offset-4">
                  Sign in
                </Link>
              </>
            )}
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
