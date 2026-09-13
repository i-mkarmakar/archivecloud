import Link from "next/link";
import { RainbowButton } from "@/components/ui/rainbow-button";

const CTA_LOGOS = [
  {
    src: "/brand/google-drive.svg",
    className: "top-[18%] left-[6%] size-12 opacity-60 sm:size-14",
  },
  {
    src: "/brand/dropbox.svg",
    className: "top-[22%] right-[8%] size-12 opacity-[0.58] sm:size-14",
  },
  {
    src: "/brand/onedrive.svg",
    className: "top-[48%] left-[10%] size-12 opacity-55 sm:left-[12%] sm:size-14",
  },
  {
    src: "/brand/icloud.svg",
    className: "top-[46%] right-[10%] size-12 opacity-55 sm:right-[12%] sm:size-14",
  },
  {
    src: "/brand/google-photos.svg",
    className: "top-[12%] left-[28%] size-12 opacity-50 sm:size-14",
  },
  {
    src: "/brand/pcloud.svg",
    className: "top-[14%] right-[26%] size-12 opacity-50 sm:size-14",
  },
  {
    src: "/brand/google.svg",
    className: "bottom-[38%] left-[22%] size-12 opacity-50 sm:size-14",
  },
] as const;

export function FinalCTA() {
  return (
    <section className="px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <div className="relative mx-auto max-w-[1200px] overflow-hidden rounded-[28px] bg-gradient-to-b from-primary to-[color-mix(in_srgb,var(--primary)_85%,black)] px-6 pt-14 pb-28 text-center sm:px-10 sm:pt-16 sm:pb-32">
        <div aria-hidden className="pointer-events-none absolute inset-0 z-[1]">
          {CTA_LOGOS.map((logo) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={logo.src}
              src={logo.src}
              alt=""
              className={`absolute object-contain select-none ${logo.className}`}
            />
          ))}
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[2] bg-black/10"
        />

        <h2 className="relative z-10 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
          Your files. Your clouds. Your control.
        </h2>
        <p className="relative z-10 mx-auto mt-4 max-w-xl text-base text-white/90 sm:text-lg">
          Bring your cloud accounts together and manage your files from one
          place.
        </p>
        <RainbowButton
          asChild
          size="lg"
          variant="outline"
          className="relative z-10 mt-8 h-12 rounded-full px-7 text-[15px] font-semibold shadow-[0_6px_14px_-8px_color-mix(in_oklch,var(--primary)_10%,transparent)]"
        >
          <Link href="/auth/sign-up">Get started for free</Link>
        </RainbowButton>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/cta-cloud.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -bottom-3 z-[3] h-auto w-full select-none sm:-bottom-4"
        />
      </div>
    </section>
  );
}
