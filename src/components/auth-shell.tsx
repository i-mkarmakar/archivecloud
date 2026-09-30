"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/drive/BrandLogo";
import CloudShaderFlightHeroDemo from "@/components/cloud-shader-flight-hero-demo";

export function AuthShell({
  children,
}: {
  children: React.ReactNode;
  mode?: "signin" | "signup";
}) {
  return (
    <div className="relative grid min-h-svh bg-white lg:grid-cols-[40%_60%]">
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
