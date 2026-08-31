"use client";

import { toast } from "@heroui/react";
import { Eye, EyeSlash } from "@gravity-ui/icons";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";
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
import { authClient } from "@/lib/auth-client";
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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const isSignIn = mode === "signin";
  const callbackUrl = searchParams.get("callbackUrl");
  const redirectPath =
    callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//")
      ? callbackUrl
      : "/all-files";

  async function continueWithGoogle() {
    setGoogleLoading(true);
    await authClient.signIn.social({
      provider: "google",
      callbackURL: redirectPath,
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    if (isSignIn) {
      const { data, error } = await authClient.signIn.email({
        email,
        password,
      });
      setLoading(false);
      if (error) {
        toast.danger(error.message ?? "Sign-in failed");
        return;
      }
      if (data) {
        router.push(redirectPath);
        router.refresh();
      }
      return;
    }

    const { error } = await authClient.signUp.email({
      email,
      password,
      name: `${firstName.trim()} ${lastName.trim()}`.trim(),
      callbackURL: redirectPath,
    });
    setLoading(false);
    if (error) {
      toast.danger(error.message ?? "Sign-up failed");
      return;
    }
    toast.success("Account created. You can sign in now.");
    router.push(redirectPath);
    router.refresh();
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
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="firstName">First Name</FieldLabel>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                required
              />
            </Field>
            <Field>
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
            disabled={loading || googleLoading}
            size="lg"
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
          <Button
            variant="outline"
            type="button"
            disabled={loading || googleLoading}
            size="lg"
            className="w-full"
            onClick={continueWithGoogle}
          >
            <GoogleLogo />
            {googleLoading ? "Redirecting..." : "Continue with Google"}
          </Button>
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
