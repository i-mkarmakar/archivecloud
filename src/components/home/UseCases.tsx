"use client";

import { Building2, User, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { SectionBadge } from "@/components/home/SectionBadge";
import { cn } from "@/lib/utils";

const CASES = [
  {
    title: "For Individuals",
    description:
      "Keep your personal files, photos and documents organized across all your clouds.",
    icon: User,
  },
  {
    title: "For Teams",
    description:
      "Share, collaborate and manage team files without switching between accounts.",
    icon: Users,
  },
  {
    title: "For Businesses",
    description:
      "Simplify file management, improve productivity and keep your data secure.",
    icon: Building2,
  },
] as const;

const ROTATE_MS = 3000;

function CaseCard({
  item,
  index,
  className,
}: {
  item: (typeof CASES)[number];
  index: number;
  className?: string;
}) {
  return (
    <article
      className={cn(
        index === 0
          ? "rounded-xl border border-transparent bg-primary p-4 shadow-[0_6px_14px_-8px_color-mix(in_oklch,var(--primary)_10%,transparent)] sm:rounded-2xl sm:p-6"
          : index === 1
            ? "rounded-xl border-2 border-primary bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:rounded-2xl sm:p-6"
            : "rounded-xl border border-[#E5EEF7] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:rounded-2xl sm:p-6",
        className,
      )}
    >
      <div
        className={
          index === 0
            ? "flex size-9 items-center justify-center rounded-lg bg-white/20 text-white sm:size-11 sm:rounded-xl"
            : "flex size-9 items-center justify-center rounded-lg bg-[#EAF4FF] text-primary sm:size-11 sm:rounded-xl"
        }
      >
        <item.icon className="size-4 sm:size-5" strokeWidth={1.75} />
      </div>
      <h3
        className={
          index === 0
            ? "mt-2.5 text-base font-semibold text-white sm:mt-4 sm:text-lg"
            : "mt-2.5 text-base font-semibold text-[#0F172A] sm:mt-4 sm:text-lg"
        }
      >
        {item.title}
      </h3>
      <p
        className={
          index === 0
            ? "mt-1.5 text-xs leading-relaxed text-white/85 sm:mt-2 sm:text-sm"
            : "mt-1.5 text-xs leading-relaxed text-[#64748B] sm:mt-2 sm:text-sm"
        }
      >
        {item.description}
      </p>
    </article>
  );
}

export function UseCases() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % CASES.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section className="px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
      <div className="mx-auto max-w-[1200px]">
        <div className="mx-auto max-w-2xl text-center">
          <SectionBadge>Use cases</SectionBadge>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#0F172A] sm:mt-4 sm:text-4xl">
            A better way to manage your digital life
          </h2>
          <p className="mt-2 text-sm text-[#64748B] sm:mt-3 sm:text-lg">
            Whether you&apos;re an individual, a team, or a business, Archive
            Cloud adapts to you.
          </p>
        </div>

        {/* Mobile: one card at a time, auto-rotate */}
        <div className="mt-6 md:hidden">
          <div className="relative mx-auto h-[200px] w-full max-w-[380px]">
            {CASES.map((item, index) => (
              <div
                key={item.title}
                aria-hidden={index !== activeIndex}
                className={cn(
                  "absolute inset-0 transition-all duration-500 ease-out",
                  index === activeIndex
                    ? "translate-x-0 opacity-100"
                    : index < activeIndex
                      ? "-translate-x-6 opacity-0"
                      : "translate-x-6 opacity-0",
                )}
              >
                <CaseCard item={item} index={index} className="h-full p-6" />
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-center gap-1.5">
            {CASES.map((item, index) => (
              <button
                key={item.title}
                type="button"
                aria-label={`Show ${item.title}`}
                aria-current={index === activeIndex}
                onClick={() => setActiveIndex(index)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  index === activeIndex
                    ? "w-4 bg-primary"
                    : "w-1.5 bg-[#CBD5E1]",
                )}
              />
            ))}
          </div>
        </div>

        {/* Desktop: all three cards */}
        <div className="mt-12 hidden gap-4 md:grid md:grid-cols-3 lg:gap-6">
          {CASES.map((item, index) => (
            <CaseCard key={item.title} item={item} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
