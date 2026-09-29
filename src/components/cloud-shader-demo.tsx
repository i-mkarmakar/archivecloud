"use client";

import { CloudShader } from "@/components/ui/cloud-shader";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { HeroGoogleSignupButton } from "@/components/home/HeroGoogleSignupButton";

export default function CloudShaderDemo() {
  return (
    <div className="relative w-full overflow-hidden">
      <CloudShader className="absolute inset-0 h-full min-h-[40rem] w-full" />

      <div className="relative z-10">
        <ContainerScroll
          titleComponent={
            <div className="mx-auto flex max-w-4xl flex-col items-center px-4 text-center">
              <div className="rounded-full border border-white/25 bg-white/15 backdrop-blur-sm">
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-[9px] font-medium tracking-wide text-white/90 sm:px-3 sm:py-1 sm:text-[13px]">
                  Open source ✦ Self-hostable ✦ Your data, your control
                </span>
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
          <img
            src="/assets/archivecloud-dashboard.png"
            alt="Archive Cloud dashboard"
            width={2048}
            height={1032}
            decoding="async"
            fetchPriority="high"
            className="mx-auto h-auto w-full rounded-sm object-contain object-top sm:rounded-xl"
            draggable={false}
          />
        </ContainerScroll>
      </div>
    </div>
  );
}
