"use client";

import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/login-form";

export function SignUpPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <LoginForm mode="signup" />
      </Suspense>
    </AuthShell>
  );
}
