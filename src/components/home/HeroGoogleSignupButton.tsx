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
    <div className="mt-8 flex flex-col items-center gap-2 sm:gap-3">
      <button
        type="button"
        disabled={loading}
        onClick={signUpWithGoogle}
        className={cn(
          buttonVariants({ size: "lg" }),
          "relative h-9 w-auto justify-center gap-0 rounded-full pr-4 pl-1.5 text-[11px] font-semibold disabled:opacity-70 sm:h-11 sm:pr-5 sm:text-xs",
        )}
      >
        <span className="absolute top-1/2 left-1.5 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-sm sm:size-8">
          <img
            src="/brand/google.svg"
            alt=""
            aria-hidden
            className="h-4 w-4 object-contain sm:h-5 sm:w-5"
          />
        </span>
        <span className="pl-7 sm:pl-9">Sign up with Google</span>
      </button>
      <p className="text-xs text-[#0F172A] sm:text-sm">
        No credit card needed.
      </p>
    </div>
  );
}
