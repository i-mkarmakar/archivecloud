"use client";

import { Suspense } from "react";
import { AppPreloader } from "@/components/AppPreloader";
import { AuthEntry } from "@/components/auth/AuthEntry";

export function SignInPage() {
  return (
    <Suspense fallback={<AppPreloader />}>
      <AuthEntry mode="signin" />
    </Suspense>
  );
}
