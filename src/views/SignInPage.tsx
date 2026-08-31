"use client";

import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/login-form";

export function SignInPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <LoginForm mode="signin" />
      </Suspense>
    </AuthShell>
  );
}
