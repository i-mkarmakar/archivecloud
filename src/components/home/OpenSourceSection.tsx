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
      className="scroll-mt-24 px-4 pb-28 pt-8 sm:px-6 sm:pb-36 sm:pt-12 lg:px-8 lg:pb-40 lg:pt-16"
    >
      <div className="relative mx-auto max-w-[1280px] overflow-visible rounded-2xl border border-[#D7E6F5] bg-[#F5FAFF] px-4 py-7 sm:rounded-[28px] sm:px-8 sm:py-10 lg:px-12 lg:py-14">
        <div className="grid min-w-0 items-start gap-6 lg:grid-cols-2 lg:gap-8">
          <div>
            <SectionBadge className="border-[#BFDFFF] bg-white text-primary">
              Open Source
            </SectionBadge>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#0F172A] sm:mt-5 sm:text-4xl lg:text-[2.75rem]">
              Built by the community.
              <br />
              For everyone.
            </h2>
            <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-[#64748B] sm:mt-4 sm:text-lg">
              Archive Cloud is open source and available under the Apache
              License 2.0. Use it as-is, contribute, or self-host it on your own
              server.
            </p>
            <ul className="mt-4 space-y-2 sm:mt-6 sm:space-y-3">
              {BULLETS.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-xs text-[#334155] sm:gap-2.5 sm:text-[15px]"
                >
                  <span className="mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full bg-[#2da44e] sm:size-4">
                    <Check
                      className="size-2 text-white sm:size-2.5"
                      strokeWidth={3}
                    />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-row flex-wrap gap-2 sm:mt-8 sm:gap-3">
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 max-w-max items-center justify-center gap-1.5 rounded-full bg-[#0F172A] px-3 text-xs font-semibold text-white shadow-[0_6px_14px_-8px_color-mix(in_oklch,var(--primary)_10%,transparent)] transition hover:bg-black sm:h-11 sm:gap-2 sm:px-6 sm:text-sm"
              >
                <GithubLogo className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                View on GitHub
                <ChevronRight
                  className="size-3.5 shrink-0 sm:size-4"
                  strokeWidth={2.5}
                />
              </a>
              <a
                href={DISCORD_INVITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex h-9 max-w-max items-center justify-center gap-1.5 rounded-full border border-[#E5EEF7] bg-white px-3 text-xs font-semibold text-[#0F172A] shadow-[0_6px_14px_-8px_color-mix(in_oklch,var(--primary)_10%,transparent)] transition hover:bg-white/80 sm:h-11 sm:gap-2 sm:px-6 sm:text-sm"
              >
                <DiscordLogo className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Join the community
              </a>
            </div>
          </div>

          {/* Fixed slot inside the bg; terminal grows and breaks out below */}
          <div className="relative mx-auto h-[200px] w-full min-w-0 max-w-lg sm:h-[240px] lg:mx-0 lg:h-0">
            <div className="absolute inset-x-0 top-0 z-10">
              <img
                src="/assets/selfhost-text.png"
                alt=""
                aria-hidden
                decoding="async"
                className="pointer-events-none mb-2 ml-auto hidden w-[82px] -rotate-12 select-none sm:block lg:w-[95px]"
              />
              <Terminal className="mx-auto max-h-none w-full min-w-0 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.35)] [&_.border-b]:p-3 sm:[&_.border-b]:p-4 [&_pre]:p-3 sm:[&_pre]:p-4 [&_code_*]:!text-xs sm:[&_code_*]:!text-sm">
                <TypingAnimation>
                  {
                    "> git clone https://github.com/i-mkarmakar/archivecloud.git"
                  }
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
      </div>
    </section>
  );
}
