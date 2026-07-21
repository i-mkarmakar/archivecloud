"use client";

import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/login-form";

export function SignInPage() {
  return (
    <AuthShell>
      <LoginForm mode="signin" />
    </AuthShell>
  );
}
