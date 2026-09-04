"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function GoogleAuthPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/auth/sign-in");
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background-secondary p-5">
      <p className="text-sm text-muted">Redirecting to sign in...</p>
    </main>
  );
}
