import { Building2, User, Users } from "lucide-react";
import { SectionBadge } from "@/components/home/SectionBadge";

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

export function UseCases() {
  return (
    <section className="px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <div className="mx-auto max-w-[1200px]">
        <div className="mx-auto max-w-2xl text-center">
          <SectionBadge>Use cases</SectionBadge>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl">
            A better way to manage your digital life
          </h2>
          <p className="mt-3 text-base text-[#64748B] sm:text-lg">
            Whether you&apos;re an individual, a team, or a business,
            Archive Cloud adapts to you.
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3 lg:gap-6">
          {CASES.map((item, index) => (
            <article
              key={item.title}
              className={
                index === 0
                  ? "rounded-2xl border border-transparent bg-primary p-6 shadow-[0_6px_14px_-8px_color-mix(in_oklch,var(--primary)_10%,transparent)]"
                  : index === 1
                    ? "rounded-2xl border-2 border-primary bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
                    : "rounded-2xl border border-[#E5EEF7] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
              }
            >
              <div
                className={
                  index === 0
                    ? "flex size-11 items-center justify-center rounded-xl bg-white/20 text-white"
                    : "flex size-11 items-center justify-center rounded-xl bg-[#EAF4FF] text-primary"
                }
              >
                <item.icon className="size-5" strokeWidth={1.75} />
              </div>
              <h3
                className={
                  index === 0
                    ? "mt-4 text-lg font-semibold text-white"
                    : "mt-4 text-lg font-semibold text-[#0F172A]"
                }
              >
                {item.title}
              </h3>
              <p
                className={
                  index === 0
                    ? "mt-2 text-sm leading-relaxed text-white/85"
                    : "mt-2 text-sm leading-relaxed text-[#64748B]"
                }
              >
                {item.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
