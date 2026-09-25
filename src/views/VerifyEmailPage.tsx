"use client";

import { Suspense, useState } from "react";
import { AppPreloader } from "@/components/AppPreloader";
import { AuthShell } from "@/components/auth-shell";
import { VerifyEmailForm } from "@/components/verify-email-form";

export function VerifyEmailPage() {
  return (
    <Suspense fallback={<AppPreloader />}>
      <VerifyEmailEntry />
    </Suspense>
  );
}

function VerifyEmailEntry() {
  const [overlay, setOverlay] = useState(false);

  if (overlay) {
    return <AppPreloader />;
  }

  return (
    <AuthShell>
      <VerifyEmailForm onShowOverlay={setOverlay} />
    </AuthShell>
  );
}
