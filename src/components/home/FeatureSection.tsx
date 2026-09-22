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
    description: "Automatically upload to the account with enough free space.",
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
    <section
      id="features"
      className="scroll-mt-24 bg-[#F5FAFF] px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16"
    >
      <div className="mx-auto max-w-[1200px]">
        <div className="mx-auto max-w-2xl text-center">
          <SectionBadge>Features</SectionBadge>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#0F172A] sm:mt-4 sm:text-4xl lg:text-[2.75rem]">
            More than just a file viewer
          </h2>
          <p className="mt-2 text-sm text-[#64748B] sm:mt-3 sm:text-lg">
            A powerful set of tools to manage your files, built for individuals,
            teams and businesses.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 items-start gap-2 sm:mt-12 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 lg:gap-5">
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="rounded-xl border border-[#E5EEF7] bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-20px_rgba(22,131,247,0.45)] sm:rounded-2xl sm:p-6"
            >
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary sm:size-10 sm:rounded-xl">
                <feature.icon className="size-4 sm:size-5" strokeWidth={1.75} />
              </div>
              <h3 className="mt-2 text-xs font-semibold leading-snug text-[#0F172A] sm:mt-4 sm:text-[16px]">
                {feature.title}
              </h3>
              <p className="mt-2 hidden text-sm leading-relaxed text-[#64748B] sm:block">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
