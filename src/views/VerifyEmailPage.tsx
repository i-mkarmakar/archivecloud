"use client";

import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { VerifyEmailForm } from "@/components/verify-email-form";

export function VerifyEmailPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <VerifyEmailForm />
      </Suspense>
    </AuthShell>
  );
}
