"use client";

import { useEffect, useState } from "react";
import { AppPreloader } from "@/components/AppPreloader";
import { HeroDashboardPreview } from "@/components/home/HeroDashboardPreview";
import { HeroGoogleSignupButton } from "@/components/home/HeroGoogleSignupButton";
import { CloudShader } from "@/components/ui/cloud-shader";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";

export default function CloudShaderDemo() {
  // Cover white-on-white hero until WebGL sky has a chance to paint.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // ponytail: double rAF ≈ after first shader draw; img onLoad if flash remains
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setReady(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, []);

  return (
    <>
      {!ready ? <AppPreloader /> : null}
      <div
        aria-hidden={!ready}
        className={
          ready
            ? "relative w-full overflow-hidden"
            : "invisible relative w-full overflow-hidden"
        }
      >
        <CloudShader className="absolute inset-0 h-full min-h-[40rem] w-full" />

        <div className="relative z-10">
          <ContainerScroll
            titleComponent={
              <div className="mx-auto flex max-w-4xl flex-col items-center px-4 text-center">
                <div className="inline-flex items-center justify-center rounded-full border border-white/25 bg-white/15 px-2.5 py-1.5 leading-none text-[9px] font-medium tracking-wide text-white/90 backdrop-blur-sm sm:px-3.5 sm:py-2 sm:text-[13px]">
                  Open source ✦ Self-hostable ✦ Your data, your control
                </div>

                <h1 className="mt-4 text-[2rem] leading-tight font-bold tracking-tight text-white drop-shadow-md sm:mt-6 sm:text-4xl md:text-6xl lg:text-7xl">
                  One place for all
                  <br />
                  your Cloud storage
                </h1>
                <p className="mt-3 max-w-xl text-xs leading-relaxed text-white/90 drop-shadow-sm sm:mt-6 sm:text-base md:text-lg">
                  Connect Google Drive, Dropbox, OneDrive, and more.
                  <br className="md:hidden" />
                  Browse, search, and move files across all your clouds
                  <br className="md:hidden" />
                  from one dashboard.
                </p>
                <div className="[&_p]:text-white/85 [&_>div]:mt-5 sm:[&_>div]:mt-8">
                  <HeroGoogleSignupButton />
                </div>
              </div>
            }
          >
            <HeroDashboardPreview />
          </ContainerScroll>
        </div>
      </div>
    </>
  );
}
