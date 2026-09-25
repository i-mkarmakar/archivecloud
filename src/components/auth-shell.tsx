"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/drive/BrandLogo";
import Grainient from "@/components/Grainient";
import { cn } from "@/lib/utils";

export function AuthShell({ children }: { children: React.ReactNode }) {
  const [grainReady, setGrainReady] = useState(false);

  return (
    <div className="grid min-h-svh bg-white lg:grid-cols-[40%_60%]">
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
      <div
        className={cn(
          "relative hidden overflow-hidden lg:block",
          // Stay white until Grainient paints — avoids a solid navy flash.
          grainReady ? "bg-[#0b3a66]" : "bg-white",
        )}
      >
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-300",
            grainReady ? "opacity-100" : "opacity-0",
          )}
        >
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
            onReady={() => setGrainReady(true)}
          />
        </div>
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 z-10 flex justify-center px-8 pb-16 transition-opacity duration-300 md:px-12 md:pb-20 lg:justify-end lg:pb-24 lg:pr-16",
            grainReady ? "opacity-100" : "opacity-0",
          )}
        >
          <div className="flex max-w-md flex-col gap-3 text-center lg:text-right">
            <p className="text-2xl font-semibold tracking-tight text-white drop-shadow-sm sm:text-3xl">
              Your storage
              <br />
              never runs out.
            </p>
            <p className="text-sm leading-relaxed text-white/80 sm:text-base lg:text-right">
              Add a free Google Drive, get more
              <br />
              space. Add another, get unlimited.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
