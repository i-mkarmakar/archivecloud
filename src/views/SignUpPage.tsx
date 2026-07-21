"use client";

import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/login-form";

export function SignUpPage() {
  return (
    <AuthShell>
      <LoginForm mode="signup" />
    </AuthShell>
  );
}
