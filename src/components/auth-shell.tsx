"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/drive/BrandLogo";
import { AuthLanguageSelect } from "@/components/auth/AuthLanguageSelect";
import CloudShaderFlightHeroDemo from "@/components/cloud-shader-flight-hero-demo";

export function AuthShell({
  children,
  mode,
}: {
  children: React.ReactNode;
  mode?: "signin" | "signup";
}) {
  return (
    <div className="relative grid min-h-svh bg-white lg:grid-cols-[40%_60%]">
      {mode ? (
        <div className="absolute top-6 right-6 z-30 flex items-center gap-4 md:top-8 md:right-8">
          <AuthLanguageSelect className="hidden lg:inline-flex" />
          {mode === "signup" ? (
            <Link
              href="/auth/sign-in"
              className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-black shadow-md transition hover:bg-white/90"
            >
              Sign In
            </Link>
          ) : (
            <Link
              href="/auth/sign-up"
              className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-black shadow-md transition hover:bg-white/90"
            >
              Register
            </Link>
          )}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link
            href="/"
            className="flex items-center gap-2 font-medium"
            aria-label="Archive Cloud home"
          >
            <BrandLogo className="size-10" />
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">{children}</div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden lg:block">
        <CloudShaderFlightHeroDemo />
      </div>
    </div>
  );
}
