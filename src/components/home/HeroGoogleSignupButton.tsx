"use client";

import { useState } from "react";
import { AppPreloader } from "@/components/AppPreloader";
import { authClient } from "@/lib/auth-client";
import { markAppBoot } from "@/lib/app-boot";
import { buttonVariants } from "@/components/site/button";
import { cn } from "@/lib/utils";

export function HeroGoogleSignupButton() {
  const [loading, setLoading] = useState(false);

  async function signUpWithGoogle() {
    if (loading) return;
    setLoading(true);
    markAppBoot();
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/home",
      });
    } catch {
      setLoading(false);
    }
  }

  if (loading) {
    return <AppPreloader />;
  }

  return (
    <div className="mt-8 flex flex-col items-center gap-3">
      <button
        type="button"
        disabled={loading}
        onClick={signUpWithGoogle}
        className={cn(
          buttonVariants({ size: "lg" }),
          "relative h-11 w-auto justify-center gap-0 rounded-full pr-5 pl-1.5 text-xs font-semibold disabled:opacity-70",
        )}
      >
        <span className="absolute top-1/2 left-1.5 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-sm">
          <img
            src="/brand/google.svg"
            alt=""
            aria-hidden
            className="h-5 w-5 object-contain"
          />
        </span>
        <span className="pl-9">Sign up with Google</span>
      </button>
      <p className="text-sm text-[#0F172A]">No credit card needed.</p>
    </div>
  );
}
