import type { Metadata } from "next";
import Link from "next/link";
import {
  ArchiveIcon,
  FolderSyncIcon,
  LayersIcon,
  MoveRightIcon,
  UsersIcon,
} from "lucide-react";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata(
  "Solutions",
  "Archive Cloud solutions for multi-account storage, cloud migration, folder sync backups, and cross-cloud organization.",
);

const SOLUTIONS = [
  {
    title: "Multi-account storage hub",
    description:
      "Connect several Google Drive, OneDrive, Dropbox, and other accounts in one place. Browse, search, and upload with routing to accounts that still have free space.",
    href: "/home",
    linkLabel: "Open home",
    icon: LayersIcon,
  },
  {
    title: "Migrate between clouds",
    description:
      "Copy or move files from one provider to another without downloading everything to your laptop first. Track jobs in Run History.",
    href: "/home",
    linkLabel: "Start a transfer",
    icon: MoveRightIcon,
  },
  {
    title: "Backup with folder sync",
    description:
      "Mirror a folder one-way or keep two locations in sync on a schedule. Polling detects content changes so backups stay current.",
    href: "/automation",
    linkLabel: "Set up automation",
    icon: FolderSyncIcon,
  },
  {
    title: "Organize across providers",
    description:
      "Use virtual folders and tags to structure files that live in different clouds: one library view without moving physical storage.",
    href: "/virtual-folders",
    linkLabel: "Virtual folders",
    icon: ArchiveIcon,
  },
  {
    title: "Share with teammates",
    description:
      "Invite Archive Cloud users to files or folders, or publish a public link with preview and download. Manage everything from Shared.",
    href: "/shared",
    linkLabel: "Sharing",
    icon: UsersIcon,
  },
] as const;

export default function SolutionsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-10 pb-24 sm:px-6">
      <p className="text-sm font-semibold text-primary">Solutions</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#0F172A] md:text-4xl">
        One hub for how you actually use multiple clouds
      </h1>
      <p className="mt-4 text-[#64748B]">
        Whether you are consolidating accounts, migrating off a provider, or
        keeping folders mirrored, Archive Cloud is built for cross-cloud work,
        not another siloed drive.
      </p>

      <div className="mt-12 grid gap-4">
        {SOLUTIONS.map((item) => (
          <article
            key={item.title}
            className="rounded-2xl border border-[#E5EEF7] bg-white p-5"
          >
            <div className="flex items-start gap-4">
              <item.icon className="mt-0.5 size-5 shrink-0 text-[#0F172A]" />
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-[#0F172A]">
                  {item.title}
                </h2>
                <p className="mt-2 text-sm text-[#64748B]">
                  {item.description}
                </p>
                <Link
                  href={item.href}
                  className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-[#0F172A] underline-offset-4 hover:underline"
                >
                  {item.linkLabel}
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>

      <p className="mt-12 text-sm text-[#64748B]">
        New here? See the{" "}
        <Link
          href="/help"
          className="text-[#0F172A] underline-offset-4 hover:underline"
        >
          Help Center
        </Link>{" "}
        or{" "}
        <Link
          href="/auth/sign-up"
          className="text-[#0F172A] underline-offset-4 hover:underline"
        >
          create a free account
        </Link>
        .
      </p>
    </div>
  );
}
