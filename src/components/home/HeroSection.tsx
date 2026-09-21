import { HeroGoogleSignupButton } from "@/components/home/HeroGoogleSignupButton";

export function HeroSection() {
  return (
    <section
      id="home"
      className="relative px-4 pt-8 pb-12 sm:px-6 sm:pt-10 lg:overflow-visible lg:px-8 lg:pt-12 lg:pb-16"
    >
      <div className="relative mx-auto w-full max-w-[1280px]">
        <img
          src="/assets/left-side.png"
          alt=""
          aria-hidden
          decoding="async"
          className="pointer-events-none absolute -top-4 -left-6 z-20 hidden h-auto w-[150px] select-none mix-blend-screen lg:block xl:-left-10 xl:w-[190px] 2xl:-left-16 2xl:w-[220px]"
        />
        <img
          src="/assets/right-side.png"
          alt=""
          aria-hidden
          decoding="async"
          className="pointer-events-none absolute top-36 -right-6 z-20 hidden h-auto w-[140px] rotate-12 select-none mix-blend-screen lg:block xl:top-44 xl:-right-10 xl:w-[180px] 2xl:-right-14 2xl:w-[210px]"
        />

        <div className="relative z-10 mx-auto flex max-w-[920px] flex-col items-center pt-10 text-center sm:pt-12 lg:pt-8">
          <div className="max-w-[calc(100vw-2rem)] rounded-full border border-black/5 bg-neutral-100">
            <span className="inline-flex items-center justify-center px-2.5 py-0.5 text-[10px] font-medium tracking-wide text-neutral-600 sm:px-4 sm:py-1 sm:text-[13px]">
              Open source ✦ Self-hostable ✦ Your data, your control
            </span>
          </div>

          <h1 className="mt-6 text-balance text-[2.5rem] leading-[1.08] font-bold tracking-tight text-[#0F172A] sm:text-5xl md:text-6xl lg:text-[4.5rem]">
            One place for all
            <br className="hidden sm:block" /> your{" "}
            <span className="text-primary">Cloud</span> storage
          </h1>

          <p className="mt-5 max-w-2xl text-pretty text-base leading-relaxed text-[#64748B] sm:text-lg">
            Connect Google Drive, Dropbox, OneDrive, and more. Browse, search,
            and move files across all your clouds from one dashboard.
          </p>

          <HeroGoogleSignupButton />
        </div>
      </div>

      <div className="relative z-10 mx-auto mt-14 max-w-[1080px] sm:mt-16 lg:mt-24">
        <div className="overflow-hidden rounded-[20px] border border-[#D7E6F5] bg-white shadow-[0_30px_80px_-36px_rgba(15,23,42,0.35)] sm:rounded-[24px]">
          <img
            src="/assets/archivecloud-dashboard.png"
            alt="Archive Cloud dashboard"
            width={2048}
            height={1032}
            decoding="async"
            fetchPriority="high"
            className="h-auto w-full object-cover object-top"
          />
        </div>
      </div>
    </section>
  );
}
