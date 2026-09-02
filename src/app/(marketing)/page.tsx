import type { Metadata } from "next";
import {
  AnimationContainer,
  MaxWidthWrapper,
  PricingCards,
} from "@/marketing/components";
import {
  BentoCard,
  BentoGrid,
  CARDS,
} from "@/marketing/components/ui/bento-grid";
import { Button } from "@/marketing/components/ui/button";
import { LampContainer } from "@/marketing/components/ui/lamp";
import MagicBadge from "@/marketing/components/ui/magic-badge";
import MagicCard from "@/marketing/components/ui/magic-card";
import { COMPANIES, PROCESS } from "@/marketing/utils";
import { ArrowRightIcon, CreditCardIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Google Drive storage gateway",
  description:
    "Connect multiple Google Drive accounts, upload through one gateway, and manage files with unified quota tracking, virtual folders, and secure sharing.",
};

export default function HomePage() {
  return (
    <div className="scrollbar-hide size-full overflow-x-hidden">
      <MaxWidthWrapper>
        <div className="flex w-full flex-col items-center justify-center bg-gradient-to-t from-background text-center">
          <AnimationContainer className="flex w-full flex-col items-center justify-center text-center">
            <button
              type="button"
              className="group relative grid overflow-hidden rounded-full border border-border bg-white/80 px-4 py-1 shadow-sm backdrop-blur-sm transition-colors duration-200 hover:bg-white"
            >
              <span className="absolute inset-x-0 bottom-0 h-full w-full bg-gradient-to-tr from-primary/10 to-transparent" />
              <span className="relative z-10 flex items-center justify-center gap-1 py-0.5 text-sm text-foreground">
                ✨ Your Google Drive gateway
                <ArrowRightIcon className="ml-1 size-3 transition-transform duration-300 ease-in-out group-hover:translate-x-0.5" />
              </span>
            </button>
            <h1 className="!leading-[1.15] w-full text-balance py-6 text-center font-heading text-5xl font-medium tracking-normal text-foreground sm:text-6xl md:text-7xl lg:text-8xl">
              Cloud storage with{" "}
              <span className="inline-bloc bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                precision
              </span>
            </h1>
            <p className="mb-12 text-balance text-lg tracking-tight text-muted-foreground md:text-xl">
              Effortlessly manage files across multiple Google Drive accounts
              with ArchiveCloud.
              <br className="hidden md:block" />
              <span className="hidden md:block">
                Upload, organize, share, and track quota from one unified
                dashboard.
              </span>
            </p>
            <div className="z-50 flex items-center justify-center gap-4 whitespace-nowrap">
              <Button asChild>
                <Link href="/signup" className="flex items-center">
                  Start for free
                  <ArrowRightIcon className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </AnimationContainer>

          <AnimationContainer
            delay={0.2}
            className="relative w-full bg-transparent px-2 pt-20 pb-20 md:py-32"
          >
            <div className="gradient animate-image-glow absolute inset-0 left-1/2 h-1/4 w-3/4 -translate-x-1/2 blur-[5rem] md:top-[10%] md:h-1/3" />
            <div className="-m-2 rounded-xl border border-border bg-white/70 p-2 shadow-lg shadow-primary/5 backdrop-blur-sm lg:-m-4 lg:rounded-2xl">
              <Image
                src="/assets/dashboard.svg"
                alt="ArchiveCloud dashboard"
                width={1200}
                height={1200}
                quality={100}
                className="rounded-md bg-muted/30 ring-1 ring-border lg:rounded-xl"
              />
              <div className="absolute inset-x-0 bottom-0 z-40 h-1/2 w-full bg-gradient-to-t from-background" />
              <div className="absolute inset-x-0 bottom-0 z-50 h-1/4 w-full bg-gradient-to-t from-background md:-bottom-8" />
            </div>
          </AnimationContainer>
        </div>
      </MaxWidthWrapper>

      <MaxWidthWrapper>
        <AnimationContainer delay={0.4}>
          <div className="py-14">
            <div className="mx-auto px-4 md:px-8">
              <h2 className="text-center font-heading text-sm font-medium text-muted-foreground uppercase">
                Trusted by teams managing cloud storage
              </h2>
              <div className="mt-8">
                <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-6 md:gap-x-16">
                  {COMPANIES.map((company) => (
                    <li key={company.name}>
                      <Image
                        src={company.logo}
                        alt={company.name}
                        width={80}
                        height={80}
                        quality={100}
                        className="h-auto w-28"
                      />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </AnimationContainer>
      </MaxWidthWrapper>

      <MaxWidthWrapper className="pt-10" id="features">
        <AnimationContainer delay={0.1}>
          <div className="flex w-full flex-col items-center justify-center py-8 lg:items-center">
            <MagicBadge title="Features" />
            <h2 className="mt-6 text-center font-heading text-3xl font-medium !leading-[1.1] text-foreground md:text-5xl lg:text-center">
              Manage storage like a pro
            </h2>
            <p className="mt-4 max-w-lg text-center text-lg text-muted-foreground lg:text-center">
              ArchiveCloud connects your Google Drive accounts with smart
              routing, virtual folders, secure sharing, and unified quota
              tracking.
            </p>
          </div>
        </AnimationContainer>
        <AnimationContainer delay={0.2}>
          <BentoGrid className="py-8">
            {CARDS.map((feature, idx) => (
              <BentoCard key={idx} {...feature} />
            ))}
          </BentoGrid>
        </AnimationContainer>
      </MaxWidthWrapper>

      <MaxWidthWrapper className="py-10" id="how-it-works">
        <AnimationContainer delay={0.1}>
          <div className="mx-auto flex w-full max-w-xl flex-col items-center justify-center py-8 lg:items-center">
            <MagicBadge title="The Process" />
            <h2 className="mt-6 text-center font-heading text-3xl font-medium !leading-[1.1] text-foreground md:text-5xl lg:text-center">
              Unified storage in 3 steps
            </h2>
            <p className="mt-4 max-w-lg text-center text-lg text-muted-foreground lg:text-center">
              Connect your Drive, upload with confidence, and share files
              without juggling multiple dashboards.
            </p>
          </div>
        </AnimationContainer>
        <div className="grid w-full grid-cols-1 gap-4 py-8 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
          {PROCESS.map((process, id) => (
            <AnimationContainer delay={0.2 * id} key={process.title}>
              <MagicCard className="group md:py-8">
                <div className="flex w-full flex-col items-start justify-center">
                  <process.icon
                    strokeWidth={1.5}
                    className="h-10 w-10 text-foreground"
                  />
                  <div className="relative flex flex-col items-start">
                    <span className="absolute -top-6 right-0 flex h-12 w-12 items-center justify-center rounded-full border-2 border-border pt-0.5 text-2xl font-medium text-foreground">
                      {id + 1}
                    </span>
                    <h3 className="mt-6 text-base font-medium text-foreground">
                      {process.title}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {process.description}
                    </p>
                  </div>
                </div>
              </MagicCard>
            </AnimationContainer>
          ))}
        </div>
      </MaxWidthWrapper>

      <MaxWidthWrapper className="py-10" id="pricing">
        <AnimationContainer delay={0.1}>
          <div className="mx-auto flex w-full max-w-xl flex-col items-center justify-center py-8 lg:items-center">
            <MagicBadge title="Simple Pricing" />
            <h2 className="mt-6 text-center font-heading text-3xl font-medium !leading-[1.1] text-foreground md:text-5xl lg:text-center">
              Choose a plan that works for you
            </h2>
            <p className="mt-4 max-w-lg text-center text-lg text-muted-foreground lg:text-center">
              Start free with your own Google Drive. Upgrade when you need more
              accounts and team features.
            </p>
          </div>
        </AnimationContainer>
        <AnimationContainer delay={0.2}>
          <PricingCards />
        </AnimationContainer>
        <AnimationContainer delay={0.3}>
          <div className="mx-auto mt-12 flex w-full max-w-5xl flex-wrap items-start justify-center gap-6 md:items-center lg:justify-evenly">
            <div className="flex items-center gap-2">
              <CreditCardIcon className="h-5 w-5 text-foreground" />
              <span className="text-muted-foreground">
                No credit card required
              </span>
            </div>
          </div>
        </AnimationContainer>
      </MaxWidthWrapper>

      <MaxWidthWrapper className="mt-20 max-w-[100vw] overflow-x-hidden scrollbar-hide">
        <AnimationContainer delay={0.1}>
          <LampContainer>
            <div className="relative flex w-full flex-col items-center justify-center text-center">
              <h2 className="mt-8 bg-gradient-to-b from-foreground to-muted-foreground bg-clip-text text-center font-heading text-4xl font-medium !leading-[1.15] tracking-tight text-transparent md:text-7xl">
                Step into unified cloud storage
              </h2>
              <p className="mx-auto mt-6 max-w-md text-muted-foreground">
                Connect your Google Drive accounts, upload with confidence, and
                share files from one next-gen platform.
              </p>
              <div className="mt-6">
                <Button asChild>
                  <Link href="/signup">
                    Get started for free
                    <ArrowRightIcon className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </LampContainer>
        </AnimationContainer>
      </MaxWidthWrapper>
    </div>
  );
}
