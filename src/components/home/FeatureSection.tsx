import type { LucideIcon } from "lucide-react";
import {
  Cloud,
  Folder,
  ArrowLeftRight,
  Search,
  Share2,
  ChartPie,
  Zap,
  ShieldCheck,
} from "lucide-react";
import { SectionBadge } from "@/components/home/SectionBadge";

const FEATURES: {
  title: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    title: "Unified File Management",
    description:
      "Browse, upload, download and manage files from all your connected clouds.",
    icon: Cloud,
  },
  {
    title: "Cross-Cloud Search",
    description: "Find any file instantly, no matter which cloud it's in.",
    icon: Search,
  },
  {
    title: "Virtual Folders",
    description:
      "Organize files from different clouds using smart virtual folders.",
    icon: Folder,
  },
  {
    title: "Move or Copy Files",
    description:
      "Transfer files between cloud accounts easily, without downloading.",
    icon: ArrowLeftRight,
  },
  {
    title: "Share & Collaborate",
    description: "Create shareable links and invite others, from any cloud.",
    icon: Share2,
  },
  {
    title: "Combined Quota",
    description: "View total and per-account storage usage in one place.",
    icon: ChartPie,
  },
  {
    title: "Smart Upload Routing",
    description:
      "Automatically upload to the account with enough free space.",
    icon: Zap,
  },
  {
    title: "Secure & Private",
    description:
      "Your data stays in your cloud accounts. We don't store your files.",
    icon: ShieldCheck,
  },
];

export function FeatureSection() {
  return (
    <section id="features" className="scroll-mt-24 bg-[#F5FAFF] px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <div className="mx-auto max-w-[1200px]">
        <div className="mx-auto max-w-2xl text-center">
          <SectionBadge>Features</SectionBadge>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl lg:text-[2.75rem]">
            More than just a file viewer
          </h2>
          <p className="mt-3 text-base text-[#64748B] sm:text-lg">
            A powerful set of tools to manage your files, built for individuals,
            teams and businesses.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-[#E5EEF7] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-20px_rgba(22,131,247,0.45)] sm:p-6"
            >
              <div className="flex size-10 items-center justify-center rounded-xl bg-[#EAF4FF] text-[#1683F7]">
                <feature.icon className="size-5" strokeWidth={1.75} />
              </div>
              <h3 className="mt-4 text-[16px] font-semibold text-[#0F172A]">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#64748B]">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
