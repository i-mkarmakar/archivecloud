"use client";

import { Check, ChevronRight } from "lucide-react";
import { DiscordLogo } from "@/components/drive/DiscordLogo";
import { GithubLogo } from "@/components/drive/GithubLogo";
import { SectionBadge } from "@/components/home/SectionBadge";
import {
  DISCORD_INVITE_URL,
  GITHUB_REPO_URL,
} from "@/components/site/nav-links";
import {
  AnimatedSpan,
  Terminal,
  TypingAnimation,
} from "@/components/ui/terminal";

const BULLETS = [
  "Full source code on GitHub",
  "Self-host with your own infrastructure",
  "Active Discord community",
  "No vendor lock-in",
  "Transparent and secure",
] as const;

export function OpenSourceSection() {
  return (
    <section
      id="open-source"
      className="scroll-mt-24 px-4 py-12 sm:px-6 lg:px-8 lg:py-16"
    >
      <div className="relative mx-auto max-w-[1280px] overflow-hidden rounded-[28px] border border-[#D7E6F5] bg-[#F5FAFF] px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
        <img
          src="/assets/selfhost-text.png"
          alt=""
          aria-hidden
          decoding="async"
          className="pointer-events-none absolute top-6 right-4 z-10 w-[70px] -rotate-12 select-none sm:top-8 sm:right-6 sm:w-[82px] lg:top-10 lg:right-8 lg:w-[95px]"
        />
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-8">
          <div>
            <SectionBadge className="border-[#BFDFFF] bg-white text-primary">
              Open Source
            </SectionBadge>
            <h2 className="mt-5 text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl lg:text-[2.75rem]">
              Built by the community.
              <br />
              For everyone.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-[#64748B] sm:text-lg">
              Archive Cloud is open source and available under the Apache License
              2.0. Use it as-is, contribute, or self-host it on your own server.
            </p>
            <ul className="mt-6 space-y-3">
              {BULLETS.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-sm text-[#334155] sm:text-[15px]"
                >
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-[#2da44e]">
                    <Check className="size-2.5 text-white" strokeWidth={3} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[#0F172A] px-6 text-sm font-semibold text-white shadow-[0_6px_14px_-8px_color-mix(in_oklch,var(--primary)_10%,transparent)] transition hover:bg-black"
              >
                <GithubLogo className="h-4 w-4" />
                View on GitHub
                <ChevronRight className="size-4 shrink-0" strokeWidth={2.5} />
              </a>
              <a
                href={DISCORD_INVITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex h-11 items-center gap-2 rounded-full border border-[#E5EEF7] bg-white px-6 text-sm font-semibold text-[#0F172A] shadow-[0_6px_14px_-8px_color-mix(in_oklch,var(--primary)_10%,transparent)] transition hover:bg-white/80"
              >
                <DiscordLogo className="h-4 w-4" />
                Join the community
              </a>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-lg lg:mx-0">
            <Terminal className="max-h-none shadow-[0_24px_60px_-20px_rgba(15,23,42,0.35)]">
              <TypingAnimation>
                {"> git clone https://github.com/i-mkarmakar/archivecloud.git"}
              </TypingAnimation>
              <AnimatedSpan className="text-[#1683F7]">
                Cloning into &apos;archivecloud&apos;...
              </AnimatedSpan>
              <TypingAnimation>{"> cd archivecloud"}</TypingAnimation>
              <TypingAnimation>{"> pnpm install"}</TypingAnimation>
              <AnimatedSpan className="text-emerald-600">
                ✔ Dependencies installed.
              </AnimatedSpan>
              <TypingAnimation>{"> cp .env.example .env"}</TypingAnimation>
              <TypingAnimation>{"> pnpm prisma:migrate"}</TypingAnimation>
              <AnimatedSpan className="text-emerald-600">
                ✔ Database migrated.
              </AnimatedSpan>
              <TypingAnimation>{"> pnpm dev"}</TypingAnimation>
              <AnimatedSpan className="text-emerald-600">
                ✔ Ready on http://localhost:9050
              </AnimatedSpan>
            </Terminal>
          </div>
        </div>
      </div>
    </section>
  );
}
