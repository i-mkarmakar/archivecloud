"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/drive/BrandLogo";
import Grainient from "@/components/Grainient";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[40%_60%]">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link
            href="/auth/sign-in"
            className="flex items-center gap-2 font-medium"
          >
            <BrandLogo className="size-10" />
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">{children}</div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-[#0b3a66] lg:block">
        <div className="absolute inset-0">
          <Grainient
            color1="#6dc4fb"
            color2="#1e9df1"
            color3="#0b3a66"
            timeSpeed={0.25}
            colorBalance={0.0}
            warpStrength={1.0}
            warpFrequency={5.0}
            warpSpeed={2.0}
            warpAmplitude={50.0}
            blendAngle={0.0}
            blendSoftness={0.05}
            rotationAmount={500.0}
            noiseScale={2.0}
            grainAmount={0.1}
            grainScale={2.0}
            grainAnimated={false}
            contrast={1.5}
            gamma={1.0}
            saturation={1.0}
            centerX={0.0}
            centerY={0.0}
            zoom={0.9}
          />
        </div>
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <div className="max-w-md space-y-3 text-center">
            <p className="text-2xl font-semibold tracking-tight text-white drop-shadow-sm">
              Your Google Drive gateway
            </p>
            <p className="text-sm text-white/80">
              Upload, organize, and share files across connected Drive accounts
              with unified quota tracking.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
